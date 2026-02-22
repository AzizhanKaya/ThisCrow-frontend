import { defineStore } from 'pinia';
import { AckType, MessageType, type Message } from '@/types';
import { websocketService } from '@/services/websocket';
import { useMeStore } from './me';
import { fetchMessages } from '@/api/message';
import type { Ack, id } from '@/types';
import { useDMStore } from './dm';

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
		loadingChats: new Map<id, boolean>(),
		hasMore: new Map<id, boolean>(),
		isInitialized: false,
	}),

	getters: {
		isLoadingChat: (state) => (id: id) => {
			return state.loadingChats.get(id);
		},
	},

	actions: {
		init() {
			if (this.isInitialized) return;

			websocketService.onMessage(MessageType.Direct, this.handleIncomingMessage);
			websocketService.onMessage(MessageType.Server, this.handleAck);

			this.isInitialized = true;
		},

		handleIncomingMessage(message: Message) {
			const chat_id = message.from;

			if (!this.messages.has(chat_id)) {
				const dmStore = useDMStore();
				dmStore.ensureUser(chat_id);
				this.messages.set(chat_id, []);
			}

			const chatMessages = this.messages.get(chat_id)!;
			const exists = chatMessages.some((m) => m.id === message.id);
			if (!exists) {
				message.sent = true;
				chatMessages.push(message);
			}
		},

		handleAck(message: Message<Ack>) {
			const { ack, payload } = message.data;
			if (ack == AckType.Received) {
				const messages = this.messages.get(message.to);
				if (!messages) return;

				const msg = messages.find((m) => m.id === payload);
				if (msg) {
					msg.sent = true;
					msg.id = message.id;
					msg.time = message.time;
				}
			}
		},

		getMessages(id: id) {
			return this.messages.get(id) || [];
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
			const meStore = useMeStore();
			return (message.from === meStore.me!.id ? message.to : message.from) as id;
		},

		async loadMore(id: id) {
			if (!this.messages.has(id) || this.loadingChats.get(id) || !this.hasMore.get(id)) return;

			const currentMessages = this.messages.get(id)!;
			const oldestMessage = currentMessages[0];

			this.loadingChats.set(id, true);

			const oldMessages = await fetchMessages({
				from: id,
				end: oldestMessage.time,
				len: 20,
			});
			if (oldMessages?.length) {
				this.messages.set(id, [...oldMessages, ...currentMessages]);
			} else {
				this.hasMore.set(id, false);
			}
			this.loadingChats.set(id, false);
		},

		async initChat(id: id) {
			if ((this.messages.has(id) && this.messages.get(id)!.length > 0) || this.loadingChats.get(id)) return;
			this.loadingChats.set(id, true);

			const msgs = await fetchMessages({
				from: id,
				end: new Date(),
			});
			this.messages.set(id, msgs);
			this.loadingChats.set(id, false);
			this.hasMore.set(id, msgs.length > 0);
		},
	},
});
