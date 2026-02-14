import type { Me, Message } from '@/types';
import { AckType, EventType, MessageType } from '@/types';
import { WS_URL } from '@/constants';
import { jsonParser } from '@/utils/json';

type MessageCallback = (message: Message) => void;

class WebSocketService {
	private static instance: WebSocketService;
	private ws: WebSocket | null = null;
	private readonly url: string;
	private messageHandlers: Map<MessageType, Set<MessageCallback>> = new Map();
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 2;
	private readonly reconnectDelay = 5000;

	private constructor() {
		this.url = WS_URL;
		this.initializeMessageHandlers();
	}

	public static getInstance(): WebSocketService {
		if (!WebSocketService.instance) {
			WebSocketService.instance = new WebSocketService();
		}
		return WebSocketService.instance;
	}

	connect() {
		if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
			this.ws = new WebSocket(this.url);

			this.ws.onopen = () => {
				console.log('WebSocket connection established');
			};

			this.ws.onmessage = this.handleIncomingMessage.bind(this);

			this.ws.onerror = (error) => {
				console.error('WebSocket error:', error);
			};

			this.ws.onclose = () => {
				console.log('WebSocket connection closed');
				if (this.reconnectAttempts < this.maxReconnectAttempts) {
					this.reconnectAttempts++;
					setTimeout(() => this.connect(), this.reconnectDelay);
				} else {
					console.error('Max reconnection attempts reached');
				}
			};
		}
	}

	private initializeMessageHandlers() {
		Object.values(MessageType).forEach((type) => {
			this.messageHandlers.set(type as MessageType, new Set());
		});
	}

	private handleIncomingMessage(event: MessageEvent) {
		try {
			const message = jsonParser.parse(event.data) as Message;
			message.time = new Date(message.time);

			console.log(message);

			const handlers = this.messageHandlers.get(message.type);
			if (handlers && handlers.size > 0) {
				handlers.forEach((handler) => handler(message));
			} else {
				console.warn(`No handlers registered for message type: ${message.type}`);
			}
		} catch (error) {
			console.error('Error handling message:', error);
		}
	}

	sendMessage(message: Message) {
		if (!this.ws) {
			throw new Error('WebSocket instance not initialized');
		}

		if (this.ws.readyState != WebSocket.OPEN) {
			throw new Error('WebSocket is not connected. Current state:' + this.getConnectionState());
		}

		console.log(message);

		this.ws.send(jsonParser.stringify(message));
	}

	onMessage(type: MessageType, callback: MessageCallback) {
		const handlers = this.messageHandlers.get(type);
		if (!handlers) {
			console.error(`Invalid message type: ${type}`);
			return;
		}

		handlers.add(callback);
	}

	offMessage(type: MessageType, callback: MessageCallback) {
		const handlers = this.messageHandlers.get(type);
		if (!handlers) {
			console.error(`Invalid message type: ${type}`);
			return;
		}

		handlers.delete(callback);
	}

	disconnect() {
		if (!this.ws) return;

		try {
			this.ws.close();
			this.messageHandlers.forEach((handlers) => handlers.clear());
			console.log('WebSocket disconnected and handlers cleared');
		} catch (error) {
			console.error('Error during disconnect:', error);
		}
	}

	getConnectionState(): string {
		if (!this.ws) return 'UNINITIALIZED';

		switch (this.ws.readyState) {
			case WebSocket.CONNECTING:
				return 'CONNECTING';
			case WebSocket.OPEN:
				return 'OPEN';
			case WebSocket.CLOSING:
				return 'CLOSING';
			case WebSocket.CLOSED:
				return 'CLOSED';
			default:
				return 'UNKNOWN';
		}
	}

	onConnectionStateChange(callback: (state: string) => void) {
		const ws = this.ws;
		if (!ws) return () => {};

		const openListener = () => callback('OPEN');
		const closeListener = () => callback('CLOSED');

		ws.addEventListener('open', openListener);
		ws.addEventListener('close', closeListener);

		return () => {
			ws.removeEventListener('open', openListener);
			ws.removeEventListener('close', closeListener);
		};
	}

	public waitForSessionInit(): Promise<Me> {
		return new Promise((resolve) => {
			const handler = (message: Message) => {
				if (message.type === MessageType.Server && message.data.ack === AckType.Initialized) {
					this.offMessage(MessageType.Server, handler);
					resolve(message.data.payload as Me);
				}
			};

			this.onMessage(MessageType.Server, handler);
		});
	}
}

export const websocketService = WebSocketService.getInstance();
export type { WebSocketService };
