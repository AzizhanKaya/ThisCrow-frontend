import type { Message } from '@/types';
import Dexie from 'dexie';

class ChatDB extends Dexie {
	messages: Dexie.Table<Message, string>;

	private static instance: ChatDB;

	constructor() {
		super('chatDB');
		this.version(1).stores({
			messages: 'id, from, to, type, time',
		});
		this.messages = this.table('messages');
	}

	public storeMessage(message: Message) {
		try {
			this.messages.put(message);
		} catch (error) {
			console.error('Failed to store message:', error);
		}
	}

	public static getInstance(): ChatDB {
		if (!ChatDB.instance) {
			ChatDB.instance = new ChatDB();
		}
		return ChatDB.instance;
	}
}

export const chatDB = ChatDB.getInstance();
