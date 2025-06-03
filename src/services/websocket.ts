import type { Message } from '@/types';
import { MessageType } from '@/types';

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
		const loc = window.location;
		const protocol = loc.protocol === 'https:' ? 'wss' : 'ws';
		this.url = `${protocol}://${loc.host}/api/ws`;
		this.initializeMessageHandlers();
	}

	public static getInstance(): WebSocketService {
		if (!WebSocketService.instance) {
			WebSocketService.instance = new WebSocketService();
		}
		return WebSocketService.instance;
	}

	private initializeMessageHandlers() {
		Object.values(MessageType).forEach((type) => {
			this.messageHandlers.set(type as MessageType, new Set());
		});
	}

	private handleIncomingMessage(event: MessageEvent) {
		try {
			const message = JSON.parse(event.data) as Message;
			message.time = new Date(message.time);

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

	sendMessage(message: Message) {
		if (!this.ws) {
			console.error('WebSocket instance not initialized');
			return;
		}

		if (this.ws.readyState !== WebSocket.OPEN) {
			console.error('WebSocket is not connected. Current state:', this.getConnectionState());
			return;
		}

		try {
			this.ws.send(JSON.stringify(message));
		} catch (error) {
			console.error('Error sending message:', error);
		}
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
		this.ws?.addEventListener('open', () => callback('OPEN'));
		this.ws?.addEventListener('close', () => callback('CLOSED'));
	}

	offConnectionStateChange(callback: (state: string) => void) {
		this.ws?.removeEventListener('open', () => callback('OPEN'));
		this.ws?.removeEventListener('close', () => callback('CLOSED'));
	}
}

export const websocketService = WebSocketService.getInstance();
export type { WebSocketService };
