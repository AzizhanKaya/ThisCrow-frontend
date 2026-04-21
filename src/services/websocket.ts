import type { Me, Message, MessageData } from '@/types';
import { type Ack, AckType, EventType, MessageType } from '@/types';
import { WS_URL } from '@/constants';
import { decode, encode } from '@/utils/msgpack';

type MessageCallback<T = any> = (message: Message<T>) => void | Promise<void>;

class WebSocketService {
	private static instance: WebSocketService;
	private ws: WebSocket | null = null;
	private readonly url: string;
	private messageHandlers: Map<MessageType, Set<MessageCallback>> = new Map();
	private errorHandlers: Set<(error: Event) => void> = new Set();
	private connectionStateHandlers: Set<(state: string) => void> = new Set();
	private pendingRequests = new Map<bigint, { resolve: Function; reject: Function; timer: any }>();
	private reconnectDelay = 1000;
	private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
	private eventQueue: Promise<void> = Promise.resolve();

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
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
			this.reconnectTimeout = null;
		}

		if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
			this.disconnect();
		}

		this.connectionStateHandlers.forEach((h) => h('CONNECTING'));

		this.ws = new WebSocket(this.url);
		this.ws.binaryType = 'arraybuffer';

		this.ws.onopen = () => {
			console.log('WebSocket connection established');

			if (this.reconnectTimeout) {
				clearTimeout(this.reconnectTimeout);
				this.reconnectTimeout = null;
			}

			this.connectionStateHandlers.forEach((h) => h('OPEN'));
		};

		this.ws.onmessage = this.handleMessage.bind(this);

		this.ws.onerror = (error) => {
			console.error('WebSocket error:', error);
			this.errorHandlers.forEach((h) => h(error));
		};

		this.ws.onclose = (event) => {
			console.log('WebSocket connection closed');
			this.connectionStateHandlers.forEach((h) => h('CLOSED'));
			if (event.code !== 1000) {
				if (this.reconnectDelay !== 10000) {
					this.reconnectDelay = Math.min(10000, this.reconnectDelay * 2);
				}
				console.log(`Reconnecting in ${this.reconnectDelay}ms...`);
				this.reconnectTimeout = setTimeout(() => {
					this.connect();
				}, this.reconnectDelay);
			}
		};
	}

	private initializeMessageHandlers() {
		Object.values(MessageType).forEach((type) => {
			this.messageHandlers.set(type as MessageType, new Set());
		});
	}

	private handleMessage(event: MessageEvent) {
		try {
			let message = decode(new Uint8Array(event.data)) as Message<MessageData>;

			console.log(message);

			if (message.type === MessageType.Server) {
				this.eventQueue = this.eventQueue
					.then(async () => {
						this.handleAck(message);
					})
					.catch((error) => {
						console.error('Error handling server message:', error);
					});
			} else {
				const handlers = this.messageHandlers.get(message.type);
				if (handlers && handlers.size > 0) {
					handlers.forEach((handler) => handler(message));
				} else {
					console.warn(`No handlers registered for message type: ${message.type}`);
				}
			}
		} catch (error) {
			console.error('Error handling message:', error);
		}
	}

	private async handleAck(message: Message<MessageData>) {
		if (this.pendingRequests.has(message.id)) {
			const data = message.data as Ack;
			const { resolve, reject, timer } = this.pendingRequests.get(message.id)!;
			clearTimeout(timer);
			this.pendingRequests.delete(message.id);

			if (data.ack === AckType.Error) {
				reject(data.payload);
			} else {
				resolve(message);
			}
		}

		const handlers = this.messageHandlers.get(message.type);
		if (handlers && handlers.size > 0) {
			const promises = Array.from(handlers).map((handler) => handler(message));
			await Promise.all(promises);
		} else {
			console.warn(`No handlers registered for message type: ${message.type}`);
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
				reject('Timeout ' + message.id);
			}, timeoutMs);

			this.pendingRequests.set(message.id, { resolve, reject, timer });
			this.sendMessage(message);
		});
	}

	onMessage<T>(type: MessageType, callback: MessageCallback<T>): () => void {
		const handlers = this.messageHandlers.get(type);
		if (!handlers) {
			throw new Error(`Invalid message type: ${type}`);
		}

		handlers.add(callback as MessageCallback<any>);

		return () => {
			handlers.delete(callback as MessageCallback<any>);
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
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
			this.reconnectTimeout = null;
		}

		this.reconnectDelay = 1000;

		if (this.ws) {
			this.ws.onopen = null;
			this.ws.onerror = null;
			this.ws.onmessage = null;
			this.ws.onclose = null;
			this.ws.close(1000, 'Close');
			this.ws = null;
			this.connectionStateHandlers.forEach((h) => h('CLOSED'));
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
			const unsubscribe = this.onMessage<Ack>(MessageType.Server, (message) => {
				if (message.type === MessageType.Server && message.data.ack === AckType.Initialized) {
					unsubscribe();
					resolve(message.data.payload as Me);
				} else if (message.type === MessageType.Server && message.data.ack === AckType.Error) {
					unsubscribe();
					reject(new Error(message.data.payload || 'Session initialization failed'));
				}
			});
		});
	}
}

export const websocketService = WebSocketService.getInstance();
export type { WebSocketService };
