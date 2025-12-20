import { fetchMessages } from '@/api/message';
import type { Message, MessageBlock, User, Server } from '@/types';
import { MessageType, type Channel } from '@/types';
import { websocketService, type WebSocketService } from './websocket';
import { ref, watch, type Ref, type Reactive, reactive } from 'vue';
import { useServerStore } from '@/stores/servers';
import { chatDB } from './db';
import { useUserStore } from '@/stores/user';

export enum ChatType {
	User = 'direct',
	Channel = 'group',
}

export type Chat = {
	chat: User | Channel;
	type: ChatType;
};

class MessageService {
	private static instance: MessageService;
	private ws: WebSocketService;
	private pendingMessages: Map<String, Message[]> = new Map();
	public readonly messageBlocks: Reactive<MessageBlock[]> = reactive([]);
	private active: Chat | null = null;

	private constructor() {
		this.ws = websocketService;
		this.initHandlers();
	}

	public static async getInstance(): Promise<MessageService> {
		if (!MessageService.instance) {
			MessageService.instance = new MessageService();
		}
		return MessageService.instance;
	}

	public sendMessage(message: Message) {
		try {
			websocketService.sendMessage(message);
			message.sent = true;
			chatDB.storeMessage(message);
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
		chatDB.storeMessage(message);
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
			const user = serverStore.getMembers(server.id)?.find((u) => u.id === id);
			if (!user) throw new Error(`User with id ${id} not found in server`);
			return user;
		}

		throw new Error(`Unknown chat type: ${this.active.type}`);
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

	public async getMessages(from: string, limit: number = 20, before?: Date): Promise<Message[]> {
		try {
			const localMessages = await this.getMessagesFromDB(from, this.active!.type, limit, before);

			const oldestLocalTime = localMessages.length > 0 ? new Date(Math.min(...localMessages.map((m) => m.time.getTime()))) : before || new Date();

			try {
				const serverMessages = await fetchMessages({
					from,
					type: this.active!.type,
					len: undefined,
					end: oldestLocalTime,
				});

				const messages: Message[] = serverMessages.map((msg) => ({
					...msg,
					time: new Date(msg.time),
				}));

				messages.map((msg) => chatDB.storeMessage(msg));

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

	private async getMessagesFromDB(from: string, type: ChatType, limit: number, before?: Date): Promise<Message[]> {
		const userStore = useUserStore();
		const me = userStore.user!.id;

		const upperTime = before?.getTime() || Date.now();

		const messages = await chatDB.messages
			.where('[from+to+type+time]')
			.between([me, from, type, 0], [me, from, type, upperTime])
			.or('[from+to+type+time]')
			.between([from, me, type, 0], [from, me, type, upperTime])
			.reverse()
			.limit(limit)
			.toArray();

		return messages;
	}
}

export const messageService: MessageService = await MessageService.getInstance();

export type { MessageService };
