import { fetchMessages } from '@/api/message';
import type { Message, MessageBlock, User, Server } from '@/types';
import { MessageType, type Channel } from '@/types';
import { websocketService, type WebSocketService } from './websocket';
import { ref, watch, type Ref, type Reactive, reactive } from 'vue';
import { useServerStore } from '@/stores/servers';

export enum ChatType {
	User,
	Channel,
}

export type Chat = {
	chat: User | Channel;
	type: ChatType;
};

class MessageService {
	private static instance: MessageService;
	private db!: IDBDatabase;
	private storeName = 'messages';
	private ws: WebSocketService;
	private pendingMessages: Map<String, Message[]> = new Map();
	public readonly messageBlocks: Reactive<MessageBlock[]> = reactive([]);
	private active: Chat | null = null;

	private constructor() {
		this.ws = websocketService;
		this.initHandlers();
	}

	private static async create(): Promise<MessageService> {
		const service = new MessageService();
		await service.initDB();
		return service;
	}

	public static async getInstance(): Promise<MessageService> {
		if (!MessageService.instance) {
			MessageService.instance = await this.create();
		}
		return MessageService.instance;
	}

	public sendMessage(message: Message) {
		try {
			websocketService.sendMessage(message);
			message.sent = true;
			this.storeMessage(message);
		} catch (e) {
			message.sent = false;
			const pendingMessages = this.pendingMessages.get(message.to!);
			pendingMessages?.push(message);
		}

		this.addMessageToBlocks(message);
	}

	public initHandlers() {
		this.ws.onMessage(MessageType.Direct, this.handleDirectMessage);
		this.ws.onMessage(MessageType.Group, this.handleGroupMessage);
		this.ws.onMessage(MessageType.Info, this.handleInfoMessage);
		this.ws.onMessage(MessageType.Server, this.handleServerMessage);
	}

	private async handleDirectMessage(message: Message) {
		if (this.active?.chat.id == message.from) {
			this.addMessageToBlocks(message);
		}
		this.storeMessage(message);
	}

	private async handleGroupMessage(message: Message) {}
	private async handleInfoMessage(message: Message) {}
	private async handleServerMessage(message: Message) {}

	private addMessageToBlocks(newMessage: Message) {
		const blocks = this.messageBlocks;

		const insertMessage = (block: any, position: 'start' | 'end') => {
			if (newMessage.from === block.user.id) {
				position === 'end' ? block.messages.push(newMessage) : block.messages.unshift(newMessage);
			} else {
				const user = this.getUserFromId(newMessage.from);
				const newBlock = { user, messages: [newMessage] };
				position === 'end' ? blocks.push(newBlock) : blocks.unshift(newBlock);
			}
		};

		if (!blocks.length) {
			blocks.push({ messages: [newMessage], user: this.getUserFromId(newMessage.from) });
			return;
		}

		const firstBlock = blocks.first!;
		const lastBlock = blocks.last!;

		const firstMessage = firstBlock.messages.first!;
		const lastMessage = lastBlock.messages.last!;

		if (newMessage.time < firstMessage.time) {
			insertMessage(firstBlock, 'start');
		} else if (newMessage.time > lastMessage.time) {
			insertMessage(lastBlock, 'end');
		}
	}

	private getUserFromId(id: string): User {
		if (!this.active) throw new Error('No active chat');

		if (this.active.type === ChatType.User) {
			return this.active.chat as User;
		}

		if (this.active.type === ChatType.Channel) {
			const server = this.active.chat as Server;
			const serverStore = useServerStore();
			const user = serverStore.members.get(server)?.find((u) => u.id === id);
			if (!user) throw new Error(`User with id ${id} not found in server`);
			return user;
		}

		throw new Error(`Unknown chat type: ${this.active.type}`);
	}

	private async initDB(): Promise<void> {
		return new Promise((resolve, reject) => {
			const request = indexedDB.open('ThisCrow', 1);

			request.onerror = () => {
				reject(new Error('Failed to open IndexedDB'));
			};

			request.onsuccess = (event) => {
				this.db = (event.target as IDBOpenDBRequest).result;
				resolve();
			};

			request.onupgradeneeded = (event) => {
				const db = (event.target as IDBOpenDBRequest).result;
				if (!db.objectStoreNames.contains(this.storeName)) {
					const store = db.createObjectStore(this.storeName, { keyPath: 'hash' });
					store.createIndex('from', 'from', { unique: false });
					store.createIndex('to', 'to', { unique: false });
					store.createIndex('type', 'type', { unique: false });
					store.createIndex('time', 'time', { unique: false });
				}
			};
		});
	}

	private async storeMessage(message: Message): Promise<void> {
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

	public async loadMessages(from: User | Server) {
		try {
			this.active = { chat: from, type: ChatType.User };
			let messages = await this.getMessages(from.id);

			messages = messages.sort((a, b) => a.time.getTime() - b.time.getTime());
			this.messageBlocks.splice(0, this.messageBlocks.length);

			for (const msg of messages) {
				this.addMessageToBlocks(msg);
			}
		} catch (error) {
			console.error('loadMessages failed:', error);
		}
	}

	public async getMessages(from: string, type: MessageType = MessageType.Direct, limit: number = 20, before?: Date): Promise<Message[]> {
		try {
			const localMessages = await this.getMessagesFromDB(from, type, limit, before);

			const oldestLocalTime = localMessages.length > 0 ? new Date(Math.min(...localMessages.map((m) => m.time.getTime()))) : before || new Date();

			try {
				const serverMessages = await fetchMessages({
					from,
					len: undefined,
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

	private async getMessagesFromDB(from: string, type: MessageType = MessageType.Direct, limit: number, before?: Date): Promise<Message[]> {
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

export const messageService: MessageService = await MessageService.getInstance();

export type { MessageService };
