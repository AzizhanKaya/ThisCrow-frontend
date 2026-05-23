import { defineStore } from 'pinia';
import { AckType, EventType, MessageType, type Event, type Message, type Reaction } from '@/types';
import { websocketService } from '@/services/websocket';
import { useMeStore } from './me';
import { useErrorStore } from './error';
import { fetchMessages, fetchMessage, fetchReactions } from '@/api/message';
import { generate_uid } from '@/utils/uid';
import type { Ack, id, snowflake_id } from '@/types';

export type ChatTarget = { kind: 'user'; user_id: id } | { kind: 'channel'; channel_id: id; group_id: id };

export function chatKey(target: ChatTarget): string {
	return target.kind === 'user' ? `u:${target.user_id}` : `c:${target.channel_id}`;
}

function mergeUnique(...arrays: Message[][]): Message[] {
	const seen = new Set<Message['id']>();
	const result: Message[] = [];
	for (const arr of arrays) {
		for (const msg of arr) {
			if (!seen.has(msg.id)) {
				seen.add(msg.id);
				result.push(msg);
			}
		}
	}
	result.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
	return result;
}

function insertSorted(arr: Message[], msg: Message) {
	let lo = 0;
	let hi = arr.length;
	while (lo < hi) {
		const mid = (lo + hi) >>> 1;
		if (arr[mid].id < msg.id) lo = mid + 1;
		else hi = mid;
	}
	if (arr[lo]?.id === msg.id) return;
	arr.splice(lo, 0, msg);
}

export const useMessageStore = defineStore('message', {
	state: () => ({
		messages: new Map<string, Message[]>(),
		loadingChats: new Map<string, boolean>(),
		hasMore: new Map<string, boolean>(),
		isolatedMessages: new Map<snowflake_id, Message>(),
		reactions: new Map<snowflake_id, Reaction[]>(),
	}),

	getters: {
		isLoadingChat: (state) => (target: ChatTarget) => {
			return state.loadingChats.get(chatKey(target));
		},
	},

	actions: {
		init() {
			this.messages = new Map();
			this.loadingChats = new Map();
			this.hasMore = new Map();
			this.isolatedMessages = new Map();
			this.reactions = new Map();
			websocketService.onMessage(MessageType.Direct, this.handleIncomingMessage);
			websocketService.onMessage(MessageType.Group, this.handleIncomingMessage);
			websocketService.onMessage(MessageType.Server, this.handleAck);
		},

		handleIncomingMessage(message: Message) {
			const key = this.getChatKey(message);

			if (!this.messages.has(key)) {
				this.messages.set(key, []);
			}

			insertSorted(this.messages.get(key)!, message);
		},

		async handleAck(message: Message<Ack>) {
			const { ack, payload } = message.data;
			switch (ack) {
				case AckType.MessageError: {
					useErrorStore().push(payload as string);
					break;
				}
				case AckType.Received: {
					const key = message.from
						? chatKey({ kind: 'channel', channel_id: message.to, group_id: message.from })
						: chatKey({ kind: 'user', user_id: message.to });
					const messages = this.messages.get(key);
					if (!messages) return;

					const idx = messages.findIndex((m) => m.id === payload);
					if (idx !== -1) {
						const msg = messages[idx];
						msg.id = message.id;
						const next = messages[idx + 1];
						const prev = messages[idx - 1];
						if ((next && next.id < msg.id) || (prev && prev.id > msg.id)) {
							messages.splice(idx, 1);
							insertSorted(messages, msg);
						}
					}
					break;
				}
				case AckType.Deleted: {
					const deletedId = payload as snowflake_id;
					for (const messages of this.messages.values()) {
						const idx = messages.findIndex((m) => m.id === deletedId);
						if (idx !== -1) {
							messages.splice(idx, 1);
							break;
						}
					}
					this.isolatedMessages.delete(deletedId);
					break;
				}
				case AckType.Overwritten: {
					const updated = payload as Message;
					const key = this.getChatKey(updated);
					const messages = this.messages.get(key);
					if (!messages) return;

					const idx = messages.findIndex((m) => m.id === updated.id);
					if (idx !== -1) {
						messages[idx] = { ...messages[idx], ...updated };
					}
					break;
				}
				case AckType.Reacted: {
					const { message: targetId, reaction } = payload as { message: snowflake_id; reaction: string };
					this.markReacted(targetId);
					const list = this.reactions.get(targetId);
					if (list) {
						if (!list.some((r) => r.user_id === message.from && r.reaction === reaction)) {
							list.push({ user_id: message.from, reaction });
							this.reactions.set(targetId, [...list]);
						}
					}
					break;
				}
				case AckType.RemovedReaction: {
					const { message: targetId, reaction } = payload as { message: snowflake_id; reaction: string };
					const list = this.reactions.get(targetId);
					if (list) {
						const next = list.filter((r) => !(r.user_id === message.from && r.reaction === reaction));
						this.reactions.set(targetId, next);
					}
					break;
				}
			}
		},

		markReacted(messageId: snowflake_id) {
			for (const messages of this.messages.values()) {
				const msg = messages.find((m) => m.id === messageId);
				if (msg) {
					msg.reacted = true;
					return;
				}
			}
			const isolated = this.isolatedMessages.get(messageId);
			if (isolated) isolated.reacted = true;
		},

		async loadReactions(messageId: snowflake_id): Promise<Reaction[]> {
			const cached = this.reactions.get(messageId);
			if (cached) return cached;
			try {
				const list = await fetchReactions(messageId);
				this.reactions.set(messageId, list);
				return list;
			} catch (e) {
				console.error('Failed to fetch reactions', e);
				return [];
			}
		},

		getReactions(messageId: snowflake_id): Reaction[] | undefined {
			return this.reactions.get(messageId);
		},

		toggleReaction(target: ChatTarget, messageId: snowflake_id, reaction: string) {
			const me = useMeStore().me;
			if (!me) return;
			const list = this.reactions.get(messageId) ?? [];
			const has = list.some((r) => r.user_id === me.id && r.reaction === reaction);
			const eventType = has ? EventType.RemoveReaction : EventType.Reaction;
			const data: Event = { event: eventType, payload: { message: messageId, reaction } };
			const envelope: Message<Event> = {
				id: generate_uid(me.id),
				from: me.id,
				to: target.kind === 'channel' ? target.channel_id : target.user_id,
				data,
				type: target.kind === 'channel' ? MessageType.InfoGroup : MessageType.Info,
				...(target.kind === 'channel' ? { group_id: target.group_id } : {}),
			};
			try {
				websocketService.sendMessage(envelope);
			} catch (e) {
				console.error('Failed to send reaction event', e);
			}
		},

		getMessages(target: ChatTarget) {
			return this.messages.get(chatKey(target));
		},

		async findMessage(target: ChatTarget, id: snowflake_id): Promise<Message | undefined> {
			const key = chatKey(target);
			const arr = this.messages.get(key);
			if (arr) {
				const m = arr.find((x) => x.id === id);
				if (m) return m;
			}
			const isolated = this.isolatedMessages.get(id);
			if (isolated) return isolated;

			const fetched = await fetchMessage(id);
			if (!fetched) return undefined;
			
			this.isolatedMessages.set(id, fetched);
			return fetched;
		},

		async loadMessagesUntil(target: ChatTarget, untilId: snowflake_id): Promise<void> {
			const key = chatKey(target);
			const isChannel = target.kind === 'channel';
			const fromId = isChannel ? target.channel_id : target.user_id;
			const groupId = isChannel ? target.group_id : undefined;
			const BATCH = 50;

			let arr = this.messages.get(key);
			if (!arr || arr.length === 0) return;

			if (arr.some((m) => m.id === untilId)) return;

			while (true) {
				const currentOldest = arr[0];

				if (currentOldest.id <= untilId) {
					break;
				}

				const batch = await fetchMessages({
					from: fromId,
					group_id: groupId,
					before: currentOldest.id,
					len: BATCH,
				});

				if (!batch || batch.length === 0) break;

				this.messages.set(key, mergeUnique(arr, batch));
				arr = this.messages.get(key)!;

				if (batch.length < BATCH) break;
			}
		},

		sendMessage(message: Message) {
			const key = this.getChatKey(message);
			const current = this.messages.get(key) || [];
			this.messages.set(key, mergeUnique(current, [message]));

			try {
				websocketService.sendMessage(message);
			} catch (e) {
				console.error(e);
				useErrorStore().pushFrom(e, 'Failed to send message.');
			}
		},

		getChatKey(message: Message): string {
			if (message.group_id) {
				return chatKey({ kind: 'channel', channel_id: message.to, group_id: message.group_id });
			}
			const meStore = useMeStore();
			const user_id = (message.from === meStore.me!.id ? message.to : message.from) as id;
			return chatKey({ kind: 'user', user_id });
		},

		async loadMore(target: ChatTarget) {
			const key = chatKey(target);
			if (!this.messages.has(key) || this.loadingChats.get(key) || this.hasMore.get(key) === false) return;

			const currentMessages = this.messages.get(key)!;
			const oldestMessage = currentMessages.reduce(
				(min, curr) => (Number(curr.id) < Number(min.id) ? curr : min),
				currentMessages[0]
			);

			if (!oldestMessage) return;

			this.loadingChats.set(key, true);

			const isChannel = target.kind === 'channel';

			const oldMessages = await fetchMessages({
				from: isChannel ? target.channel_id : target.user_id,
				group_id: isChannel ? target.group_id : undefined,
				before: oldestMessage.id,
				len: 50,
			});

			if (oldMessages?.length) {
				this.messages.set(key, mergeUnique(oldMessages, currentMessages));
				this.hasMore.set(key, oldMessages.length >= 50);
			} else {
				this.hasMore.set(key, false);
			}
			this.loadingChats.set(key, false);
		},

		async initChat(target: ChatTarget) {
			const key = chatKey(target);
			if (this.loadingChats.get(key)) return;
			if (this.hasMore.get(key) !== undefined && this.messages.has(key)) return;
			this.loadingChats.set(key, true);

			const isChannel = target.kind === 'channel';

			const msgs = await fetchMessages({
				from: isChannel ? target.channel_id : target.user_id,
				group_id: isChannel ? target.group_id : undefined,
				len: 50,
			});

			const current = this.messages.get(key) || [];
			this.messages.set(key, mergeUnique(msgs, current));
			this.loadingChats.set(key, false);
			this.hasMore.set(key, msgs.length >= 50);
		},
	},
});
