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
	private pendingRequests = new Map<bigint, { resolve: Function; reject: Function; timer: any }>();
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
		if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
			this.disconnect();
		}

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
			console.error('WebSocket error:', error);
			this.errorHandlers.forEach((h) => h(error));
		};

		this.ws.onclose = (event) => {
			console.log('WebSocket connection closed');
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

			console.log(message);

			if (message.type === MessageType.Server && this.pendingRequests.has(message.id)) {
				const { resolve, reject, timer } = this.pendingRequests.get(message.id)!;
				clearTimeout(timer);
				this.pendingRequests.delete(message.id);

				if (message.data.ack === AckType.Error) {
					reject(new Error(message.data.payload as string));
				} else {
					resolve(message);
				}
			}

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

		this.ws.send(encode(message));
	}

	public async request(message: Message<any>, timeoutMs: number = 5000): Promise<any> {
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pendingRequests.delete(message.id);
				reject(new Error('Timeout'));
			}, timeoutMs);

			this.pendingRequests.set(message.id, { resolve, reject, timer });
			this.sendMessage(message);
		});
	}

	onMessage(type: MessageType, callback: MessageCallback): () => void {
		const handlers = this.messageHandlers.get(type);
		if (!handlers) {
			console.error(`Invalid message type: ${type}`);
			throw new Error(`Invalid message type: ${type}`);
		}

		handlers.add(callback);
		return () => {
			handlers.delete(callback);
		};
	}

	offMessage(type: MessageType, callback: MessageCallback) {
		const handlers = this.messageHandlers.get(type);
		if (!handlers) {
			console.error(`Invalid message type: ${type}`);
			throw new Error(`Invalid message type: ${type}`);
		}

		handlers.delete(callback);
	}

	onError(callback: (error: Event) => void) {
		this.errorHandlers.add(callback);
	}

	disconnect() {
		if (this.ws) {
			this.ws.close(1000, 'Close');
			this.ws.onopen = null;
			this.ws.onerror = null;
			this.ws.onmessage = null;
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
