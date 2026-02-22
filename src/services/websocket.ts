import type { Me, Message } from '@/types';
import { AckType, EventType, MessageType } from '@/types';
import { WS_URL } from '@/constants';
import { decode, encode } from '@/utils/msgpack';

type MessageCallback = (message: Message) => void;

class WebSocketService {
	private static instance: WebSocketService;
	private ws: WebSocket | null = null;
	private readonly url: string;
	private messageHandlers: Map<MessageType, Set<MessageCallback>> = new Map();
	private errorHandlers: Set<(error: Event) => void> = new Set();
	private connectionStateHandlers: Set<(state: string) => void> = new Set();
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

	cleanup() {
		if (this.ws) {
			console.log('Cleaned websocket');
			this.ws.onopen = null;
			this.ws.onclose = null;
			this.ws.onerror = null;
			this.ws.onmessage = null;
			this.ws.close();
		}
	}

	connect() {
		if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
			return;
		}

		this.cleanup();

		this.connectionStateHandlers.forEach((h) => h('CONNECTING'));

		this.ws = new WebSocket(this.url);
		this.ws.binaryType = 'arraybuffer';

		this.ws.onopen = () => {
			console.log('WebSocket connection established');
			this.reconnectAttempts = 0;
			this.connectionStateHandlers.forEach((h) => h('OPEN'));
		};

		this.ws.onmessage = this.handleIncomingMessage.bind(this);

		this.ws.onerror = (error) => {
			this.errorHandlers.forEach((h) => h(error));
			console.error('WebSocket error:', error);
		};

		this.ws.onclose = (event) => {
			this.connectionStateHandlers.forEach((h) => h('CLOSED'));
			if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
				const delay = Math.min(10000, this.reconnectDelay * Math.pow(2, this.reconnectAttempts));

				console.log(`Reconnecting in ${delay}ms...`);
				setTimeout(() => {
					this.reconnectAttempts++;
					this.connect();
				}, delay);
			}
		};
	}

	private initializeMessageHandlers() {
		Object.values(MessageType).forEach((type) => {
			this.messageHandlers.set(type as MessageType, new Set());
		});
	}

	private handleIncomingMessage(event: MessageEvent) {
		try {
			let message = decode(new Uint8Array(event.data)) as Message;

			message.time = new Date(Number(message.time));

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

		const payload = { ...message, time: BigInt(message.time.getTime()) };

		console.log(payload);

		this.ws.send(encode(payload));
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

	onError(callback: (error: Event) => void) {
		this.errorHandlers.add(callback);
	}

	disconnect() {
		if (this.ws) {
			this.messageHandlers.forEach((callback) => {
				callback.clear();
			});
			console.log('disconnect');
			this.ws.close(1000, 'Close');
			this.ws = null;
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
		this.connectionStateHandlers.add(callback);
		return () => {
			this.connectionStateHandlers.delete(callback);
		};
	}

	public waitForSessionInit(): Promise<Me> {
		return new Promise((resolve, reject) => {
			const handler = (message: Message) => {
				if (message.type === MessageType.Server && message.data.ack === AckType.Initialized) {
					this.offMessage(MessageType.Server, handler);
					resolve(message.data.payload as Me);
				} else if (message.type === MessageType.Server && message.data.ack === AckType.Error) {
					this.offMessage(MessageType.Server, handler);
					reject(new Error(message.data.payload || 'Session initialization failed'));
				}
			};

			this.onMessage(MessageType.Server, handler);
		});
	}
}

export const websocketService = WebSocketService.getInstance();
export type { WebSocketService };
