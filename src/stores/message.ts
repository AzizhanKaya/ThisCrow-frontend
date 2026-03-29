import { defineStore } from 'pinia';
import { AckType, MessageType, type Message } from '@/types';
import { websocketService } from '@/services/websocket';
import { useMeStore } from './me';
import { fetchMessages } from '@/api/message';
import type { Ack, id } from '@/types';
import { snowflake_to_date } from '@/utils/snowflake';

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
	return result;
}

export const useMessageStore = defineStore('message', {
	state: () => ({
		messages: new Map<string, Message[]>(),
		loadingChats: new Map<string, boolean>(),
		hasMore: new Map<string, boolean>(),
	}),

	getters: {
		isLoadingChat: (state) => (target: ChatTarget) => {
			return state.loadingChats.get(chatKey(target));
		},
	},

	actions: {
		init() {
			websocketService.onMessage(MessageType.Direct, this.handleIncomingMessage);
			websocketService.onMessage(MessageType.Group, this.handleIncomingMessage);
			websocketService.onMessage(MessageType.Server, this.handleAck);
		},

		handleIncomingMessage(message: Message) {
			const key = this.getChatKey(message);

			if (!this.messages.has(key)) {
				this.messages.set(key, []);
			}

			const chatMessages = this.messages.get(key)!;
			const exists = chatMessages.some((m) => m.id === message.id);
			if (!exists) {
				chatMessages.push(message);
			}
		},

		async handleAck(message: Message<Ack>) {
			const { ack, payload } = message.data;
			if (ack == AckType.Received) {
				const key = message.from
					? chatKey({ kind: 'channel', channel_id: message.to, group_id: message.from })
					: chatKey({ kind: 'user', user_id: message.to });
				const messages = this.messages.get(key);
				if (!messages) return;

				const msg = messages.find((m) => m.id === payload);
				if (msg) {
					msg.id = message.id;
				}
			}
		},

		getMessages(target: ChatTarget) {
			return this.messages.get(chatKey(target)) || [];
		},

		sendMessage(message: Message) {
			const key = this.getChatKey(message);
			const current = this.messages.get(key) || [];
			this.messages.set(key, mergeUnique(current, [message]));

			try {
				websocketService.sendMessage(message);
			} catch (e) {
				console.error(e);
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
				end: snowflake_to_date(oldestMessage.id),
				len: 50,
			});

			if (oldMessages?.length) {
				this.messages.set(key, mergeUnique(oldMessages, currentMessages));
			} else {
				this.hasMore.set(key, false);
			}
			this.loadingChats.set(key, false);
		},

		async initChat(target: ChatTarget) {
			const key = chatKey(target);
			if (this.hasMore.has(key) || this.loadingChats.get(key)) return;
			this.loadingChats.set(key, true);

			const oldestMessageId = this.messages.get(key)?.[0]?.id;
			const oldest_date = oldestMessageId ? snowflake_to_date(oldestMessageId) : undefined;

			const isChannel = target.kind === 'channel';

			const msgs = await fetchMessages({
				from: isChannel ? target.channel_id : target.user_id,
				group_id: isChannel ? target.group_id : undefined,
				end: oldest_date || new Date(),
			});

			const current = this.messages.get(key) || [];
			this.messages.set(key, mergeUnique(msgs, current));
			this.loadingChats.set(key, false);
			this.hasMore.set(key, msgs.length > 0);
		},
	},
});
