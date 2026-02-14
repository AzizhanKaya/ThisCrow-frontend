import { defineStore } from 'pinia';
import { AckType, MessageType, type Message } from '@/types';
import { websocketService } from '@/services/websocket';
import { useUserStore } from './user';
import { fetchMessages } from '@/api/message';
import type { Ack, id } from '@/types';

export function generateTempId(): id {
	const array = new Uint32Array(2);
	window.crypto.getRandomValues(array);
	const high = BigInt(array[0]);
	const low = BigInt(array[1]);
	const u64 = (high << 32n) | low;

	return u64 as id;
}

export const useMessageStore = defineStore('message', {
	state: () => ({
		messages: new Map<id, Message[]>(),
		loadingChats: new Map<id, Promise<Message[]>>(),
		hasMore: new Map<id, boolean>(),
		isInitialized: false,
	}),

	actions: {
		init() {
			if (this.isInitialized) return;

			websocketService.onMessage(MessageType.Direct, this.handleIncomingMessage);
			websocketService.onMessage(MessageType.Server, this.handleAck);
			websocketService.onConnectionStateChange(this.handleConnectionStateChange);

			this.isInitialized = true;
		},

		handleConnectionStateChange(state: string) {
			if (state !== 'OPEN') return;
		},

		handleIncomingMessage(message: Message) {
			const chatId = message.from;

			if (!this.messages.has(chatId)) {
				this.messages.set(chatId, []);
			}

			const chatMessages = this.messages.get(chatId)!;
			const exists = chatMessages.some((m) => m.id === message.id);
			if (!exists) {
				chatMessages.push(message);
			}
		},

		handleAck(message: Message<Ack>) {
			const data = message.data;
			if (data.ack == AckType.Received) {
				if (!this.messages.has(message.to)) return;

				const chatMessages = this.messages.get(message.to)!;
				const received_id = data.payload;

				const msgIndex = chatMessages.findIndex((m) => m.id === received_id);

				if (msgIndex !== -1) {
					const msg = chatMessages[msgIndex];
					msg.sent = true;
					msg.id = message.id;
					msg.time = message.time;
				}
			}
		},

		sendMessage(message: Message) {
			const chatId = message.to;

			if (!this.messages.has(chatId)) {
				this.messages.set(chatId, []);
			}
			this.messages.get(chatId)!.push(message);

			try {
				websocketService.sendMessage(message);
			} catch (e) {
				console.error(e);
			}
		},

		getChatId(message: Message): id {
			const userStore = useUserStore();
			const currentUserId = userStore.user!.id;

			return (message.from === currentUserId ? message.to : message.from) as id;
		},

		async loadMore(id: id) {
			if (!this.messages.has(id) || this.loadingChats.has(id)) return;
			if (this.hasMore.has(id) && this.hasMore.get(id) === false) return;

			const currentMessages = this.messages.get(id)!;
			const oldestMessage = currentMessages[0];

			const fetchPromise = fetchMessages({
				from: id,
				end: oldestMessage.time,
				len: 20,
			});

			this.loadingChats.set(id, fetchPromise);

			try {
				const oldMessages = await fetchPromise;
				if (oldMessages?.length) {
					this.messages.set(id, [...oldMessages, ...currentMessages]);
				} else {
					this.hasMore.set(id, false);
				}
			} catch (e) {
				console.error(e);
			} finally {
				this.loadingChats.delete(id);
			}
		},

		async initChat(id: id) {
			if (this.messages.has(id) && this.messages.get(id)!.length > 0) return;

			if (this.loadingChats.has(id)) {
				await this.loadingChats.get(id);
				return;
			}

			const fetchPromise = fetchMessages({
				from: id,
				end: new Date(),
			});

			this.loadingChats.set(id, fetchPromise);

			try {
				const msgs = await fetchPromise;
				this.messages.set(id, msgs);
				this.hasMore.set(id, msgs.length > 0);
			} catch (e) {
				console.error(e);
			} finally {
				this.loadingChats.delete(id);
			}
		},
	},
});
