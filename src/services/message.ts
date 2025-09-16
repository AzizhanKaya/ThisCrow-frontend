import { getMessages as fetchMessages } from '@/api/message';
import type { Message } from '@/types';
import { MessageType } from '@/types';

class MessageService {
	private db: IDBDatabase | null = null;
	private dbName = 'ThisCrowMessages';
	private storeName = 'messages';
	private dbVersion = 1;
	private static instance: MessageService;

	private constructor() {
		this.initDB().catch(console.error);
	}

	public static getInstance(): MessageService {
		if (!MessageService.instance) {
			MessageService.instance = new MessageService();
		}
		return MessageService.instance;
	}

	private async initDB(): Promise<void> {
		return new Promise((resolve, reject) => {
			const request = indexedDB.open(this.dbName, this.dbVersion);

			request.onerror = () => {
				console.error('Failed to open IndexedDB');
				reject(new Error('Failed to open IndexedDB'));
			};

			request.onsuccess = (event) => {
				this.db = (event.target as IDBOpenDBRequest).result;
				resolve();
			};

			request.onupgradeneeded = (event) => {
				const db = (event.target as IDBOpenDBRequest).result;
				if (!db.objectStoreNames.contains(this.storeName)) {
					const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
					store.createIndex('from', 'from', { unique: false });
					store.createIndex('to', 'to', { unique: false });
					store.createIndex('type', 'type', { unique: false });
					store.createIndex('time', 'time', { unique: false });
				}
			};
		});
	}

	public async storeMessage(message: Message): Promise<void> {
		if (!this.db) {
			console.warn('IndexedDB not initialized');
			return Promise.resolve();
		}

		return new Promise((resolve, reject) => {
			const transaction = this.db!.transaction([this.storeName], 'readwrite');
			const store = transaction.objectStore(this.storeName);

			const request = store.put(message);

			request.onsuccess = () => resolve();
			request.onerror = (event) => {
				console.error('Failed to store message:', event);
				reject(event);
			};
		});
	}

	public async getMessages(from: string, type: MessageType = MessageType.Direct, limit: number = 20, before?: Date): Promise<Message[]> {
		try {
			const localMessages = await this.getMessagesFromIndexedDB(from, type, limit, before);

			const oldestLocalTime = localMessages.length > 0 ? new Date(Math.min(...localMessages.map((m) => m.time.getTime()))) : before || new Date();

			try {
				const serverMessages = await fetchMessages({
					from,
					len: limit,
					end: oldestLocalTime,
				});

				const messages: Message[] = serverMessages.map((msg) => ({
					...msg,
					type: msg.type,
					from: msg.from,
					time: new Date(msg.time),
					data: msg.data,
				}));

				await Promise.all(messages.map((msg) => this.storeMessage(msg)));

				const allMessages = [...localMessages, ...messages].sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, limit);

				return allMessages;
			} catch (error) {
				console.warn('Failed to fetch messages from server, using local messages only', error);
				return localMessages;
			}
		} catch (error) {
			console.error('Error in getMessages:', error);
			return [];
		}
	}

	private async getMessagesFromIndexedDB(from: string, type: MessageType = MessageType.Direct, limit: number, before?: Date): Promise<Message[]> {
		if (!this.db) {
			console.warn('IndexedDB not initialized');
			return [];
		}

		return new Promise((resolve) => {
			const transaction = this.db!.transaction([this.storeName], 'readonly');
			const store = transaction.objectStore(this.storeName);

			const index = store.index('time');
			const upperBound = before || new Date();
			const range = IDBKeyRange.upperBound(upperBound);

			const request = index.openCursor(range, 'next');

			const messages: Message[] = [];

			request.onsuccess = (event) => {
				const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
				if (cursor && messages.length < limit) {
					const message = cursor.value as Message;
					const messageTime = message.time ? new Date(message.time) : new Date(0);

					const isInConversation = type === MessageType.Direct ? message.from === from || message.to === from : message.type === type && (message.from === from || message.to === from);

					if (isInConversation) {
						messages.push({
							...message,
							time: messageTime,
							sent: true,
						});
					}
					cursor.continue();
				} else {
					resolve(messages);
				}
			};

			request.onerror = (error) => {
				console.error('Error reading messages from IndexedDB:', error);
				resolve([]);
			};
		});
	}
}

export const messageService: MessageService = new Proxy({} as MessageService, {
	get(_target, prop, _receiver) {
		const instance = MessageService.getInstance() as any;
		const value = instance[prop as keyof MessageService];
		if (typeof value === 'function') {
			return value.bind(instance);
		}
		return value;
	},
});

export type { MessageService };
