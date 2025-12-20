import { defineStore } from 'pinia';
import { MessageType, type Message, type User } from '@/types';
import { v5 as uuidv5 } from 'uuid';
import stringify from 'fast-json-stable-stringify';
import { websocketService } from '@/services/websocket';
import { useUserStore } from './user';

const MESSAGE_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

export function computeId(message: Message): string {
	const { id, ...dataToHash } = message;
	const canonicalString = stringify(dataToHash);

	return uuidv5(canonicalString, MESSAGE_NAMESPACE);
}

export const useMessageStore = defineStore('message', {
	state: () => ({
		messages: {} as Record<string, Message[]>,
		waitingMessages: {} as Record<string, Message[]>,
		isInitialized: false,
	}),

	actions: {
		init() {
			if (this.isInitialized) return;

			const ws = websocketService;

			ws.onMessage(MessageType.Direct, (message: Message) => {
				this.handleIncomingMessage(message);
			});

			const unsubscribe = ws.onConnectionStateChange(this.handleConnectionStateChange);

			this.isInitialized = true;
		},

		handleConnectionStateChange(state: string) {
			if (state !== 'OPEN') return;

			Object.entries(this.waitingMessages).forEach(([chatId, messages]) => {
				const remaining = messages.filter((message) => {
					try {
						websocketService.sendMessage(message);
						return false;
					} catch (e) {
						return true;
					}
				});

				if (remaining.length > 0) {
					this.waitingMessages[chatId] = remaining;
				} else {
					delete this.waitingMessages[chatId];
				}
			});
		},

		handleIncomingMessage(message: Message) {
			const userStore = useUserStore();

			message.id = computeId(message);

			const chatId = (message.from === userStore.user!.id ? message.to : message.from) as string;

			if (!this.messages[chatId]) {
				this.messages[chatId] = [];
			}

			const exists = this.messages[chatId].some((m) => m.id === message.id);
			if (!exists) {
				this.messages[chatId].push(message);
			}
		},

		sendMessage(message: Message) {
			try {
				websocketService.sendMessage(message);
			} catch (e) {
				this.waitingMessages[message.to].push(message);
			}
			this.handleIncomingMessage(message);
		},
	},
});
