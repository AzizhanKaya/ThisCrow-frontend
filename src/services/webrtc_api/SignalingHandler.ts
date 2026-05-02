import { websocketService } from '../websocket';
import { EventType, MessageType, type Event, type id } from '@/types';
import { useMeStore } from '@/stores/me';
import { generate_uid } from '@/utils/uid';

export class SignalingHandler {
	private pendingCandidates = new Map<id, { candidates: RTCIceCandidateInit[]; timestamp: number }>();
	private pendingOffers = new Map<id, { sdp: string; timestamp: number }>();
	private cleanupTimer: number | undefined;

	onOffer: ((userId: id, sdp: string) => Promise<void>) | null = null;
	onAnswer: ((userId: id, sdp: string) => Promise<void>) | null = null;
	onIceCandidate: ((userId: id, candidate: RTCIceCandidateInit) => Promise<void>) | null = null;

	constructor(private pendingBufferTtlMs: number) {
		this.setupWebSocketHandlers();
		this.startCleanupTimer();
	}

	private get me() {
		return useMeStore().me;
	}

	private setupWebSocketHandlers() {
		websocketService.onMessage<Event>(MessageType.Info, async (message) => {
			const { from, data } = message;
			try {
				switch (data.event) {
					case EventType.Offer:
						await this.onOffer?.(from, data.payload);
						break;
					case EventType.Answer:
						await this.onAnswer?.(from, data.payload);
						break;
					case EventType.IceCandidate:
						await this.onIceCandidate?.(from, data.payload);
						break;
				}
			} catch (e) {
				console.error(`[Signaling] Error handling ${data.event} from ${from}:`, e);
			}
		});
	}

	sendOffer(userId: id, sdp: string) {
		websocketService.sendMessage({
			id: generate_uid(this.me!.id),
			type: MessageType.Info,
			from: this.me!.id,
			to: userId,
			data: { event: EventType.Offer, payload: sdp },
		});
	}

	sendAnswer(userId: id, sdp: string) {
		websocketService.sendMessage({
			id: generate_uid(this.me!.id),
			type: MessageType.Info,
			from: this.me!.id,
			to: userId,
			data: { event: EventType.Answer, payload: sdp },
		});
	}

	sendIceCandidate(userId: id, candidate: RTCIceCandidateInit) {
		websocketService.sendMessage({
			id: generate_uid(this.me!.id),
			type: MessageType.Info,
			from: this.me!.id,
			to: userId,
			data: { event: EventType.IceCandidate, payload: candidate },
		});
	}

	bufferCandidate(userId: id, candidate: RTCIceCandidateInit) {
		const entry = this.pendingCandidates.get(userId);
		if (entry) {
			entry.candidates.push(candidate);
		} else {
			this.pendingCandidates.set(userId, { candidates: [candidate], timestamp: Date.now() });
		}
	}

	drainCandidates(userId: id): RTCIceCandidateInit[] {
		const entry = this.pendingCandidates.get(userId);
		this.pendingCandidates.delete(userId);
		return entry?.candidates ?? [];
	}

	bufferOffer(userId: id, sdp: string) {
		this.pendingOffers.set(userId, { sdp, timestamp: Date.now() });
	}

	drainOffer(userId: id): string | null {
		const entry = this.pendingOffers.get(userId);
		this.pendingOffers.delete(userId);
		return entry?.sdp ?? null;
	}

	hasPendingOffer(userId: id): boolean {
		return this.pendingOffers.has(userId);
	}

	clearPending(userId: id) {
		this.pendingCandidates.delete(userId);
		this.pendingOffers.delete(userId);
	}

	clearAll() {
		this.pendingCandidates.clear();
		this.pendingOffers.clear();
	}

	private startCleanupTimer() {
		this.cleanupTimer = window.setInterval(() => {
			const now = Date.now();
			for (const [userId, entry] of this.pendingCandidates) {
				if (now - entry.timestamp > this.pendingBufferTtlMs) {
					this.pendingCandidates.delete(userId);
				}
			}
			for (const [userId, entry] of this.pendingOffers) {
				if (now - entry.timestamp > this.pendingBufferTtlMs) {
					this.pendingOffers.delete(userId);
				}
			}
		}, this.pendingBufferTtlMs);
	}

	dispose() {
		if (this.cleanupTimer) clearInterval(this.cleanupTimer);
		this.pendingCandidates.clear();
		this.pendingOffers.clear();
	}
}
