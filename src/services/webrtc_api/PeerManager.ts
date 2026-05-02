import { markRaw, reactive } from 'vue';
import type { id } from '@/types';
import { useMeStore } from '@/stores/me';
import { type PeerConnection, type WebRTCConfig, PeerState, DEFAULT_CONFIG } from './types';
import type { SignalingHandler } from './SignalingHandler';

export class PeerManager {
	public pcs: Map<id, PeerConnection> = reactive(new Map());

	private connectionTimers = new Map<id, number>();
	private iceRestartCounts = new Map<id, number>();

	onTrackReceived: ((userId: id, track: MediaStreamTrack, connection: RTCPeerConnection) => void) | null = null;
	onPeerConnected: ((userId: id) => void) | null = null;
	onPeerRemoved: ((userId: id) => void) | null = null;
	onStateChange: (() => void) | null = null;

	constructor(
		private signaling: SignalingHandler,
		private config: WebRTCConfig = DEFAULT_CONFIG,
	) {
		this.wireSignalingCallbacks();
	}

	private get me() {
		return useMeStore().me;
	}

	/** Polite peer yields on glare (simultaneous offers) */
	private isPolite(userId: id): boolean {
		return this.me!.id < userId;
	}

	private wireSignalingCallbacks() {
		// onOffer is wired by WebRTCService so it can apply call-state gating before we accept.
		this.signaling.onAnswer = (userId, sdp) => this.handleAnswer(userId, sdp);
		this.signaling.onIceCandidate = (userId, candidate) => this.handleIceCandidate(userId, candidate);
	}

	private shouldOffer(userId: id): boolean {
		return !!this.me && this.me.id > userId;
	}

	// ── Offer (called by WebRTCService after gating) ────────────

	public async acceptOffer(userId: id, sdp: string) {
		let peer = this.pcs.get(userId);
		let createdHere = false;
		if (!peer) {
			peer = this.createPeer(userId);
			this.pcs.set(userId, peer);
			createdHere = true;
		}

		const polite = this.isPolite(userId);
		const offerCollision = peer.makingOffer || peer.connection.signalingState !== 'stable';

		peer.ignoreOffer = !polite && offerCollision;
		if (peer.ignoreOffer) return;

		if (offerCollision) {
			await peer.connection.setLocalDescription({ type: 'rollback' });
		}

		await peer.connection.setRemoteDescription({ type: 'offer', sdp });

		// Force every transceiver to sendrecv so we can also send media after replaceTrack,
		// even if our local track wasn't ready when the offer arrived.
		peer.connection.getTransceivers().forEach((t) => {
			try {
				if (t.direction !== 'stopped') t.direction = 'sendrecv';
			} catch {}
		});

		const buffered = this.signaling.drainCandidates(userId);
		for (const c of buffered) {
			try {
				await peer.connection.addIceCandidate(c);
			} catch (e) {
				console.warn('[PeerManager] Buffered ICE candidate error:', e);
			}
		}

		this.injectLocalTracksIfNeeded(peer);

		const answer = await peer.connection.createAnswer();
		await peer.connection.setLocalDescription(answer);
		this.signaling.sendAnswer(userId, answer.sdp!);

		if (createdHere) {
			this.startConnectionTimeout(userId);
		}
		this.onStateChange?.();
	}

	// ── Perfect Negotiation: Answer ─────────────────────────────

	private async handleAnswer(userId: id, sdp: string) {
		const peer = this.pcs.get(userId);
		if (!peer) return;

		peer.isSettingRemoteAnswerPending = true;
		try {
			await peer.connection.setRemoteDescription({ type: 'answer', sdp });
		} finally {
			peer.isSettingRemoteAnswerPending = false;
		}

		const buffered = this.signaling.drainCandidates(userId);
		for (const c of buffered) {
			try {
				await peer.connection.addIceCandidate(c);
			} catch (e) {
				console.warn('[PeerManager] Buffered ICE candidate error:', e);
			}
		}
	}

	// ── ICE Candidate ───────────────────────────────────────────

	private async handleIceCandidate(userId: id, candidate: RTCIceCandidateInit) {
		const peer = this.pcs.get(userId);
		if (peer && peer.connection.remoteDescription && !peer.isSettingRemoteAnswerPending) {
			try {
				await peer.connection.addIceCandidate(candidate);
			} catch (e) {
				if (!peer.ignoreOffer) {
					console.error('[PeerManager] ICE candidate error:', e);
				}
			}
		} else {
			this.signaling.bufferCandidate(userId, candidate);
		}
	}

	// ── Connect ─────────────────────────────────────────────────

	async connectPeers(userIds: id[]) {
		await Promise.all(
			userIds.map(async (userId) => {
				if (this.pcs.has(userId)) return;

				const peer = this.createPeer(userId);
				this.pcs.set(userId, peer);

				this.setupTransceivers(peer);
				await this.negotiate(peer);
				this.startConnectionTimeout(userId);
			}),
		);
	}

	private async negotiate(peer: PeerConnection) {
		try {
			peer.makingOffer = true;
			const offer = await peer.connection.createOffer();

			if (peer.connection.signalingState !== 'stable' && peer.connection.signalingState !== 'have-local-offer') {
				return;
			}

			await peer.connection.setLocalDescription(offer);
			this.signaling.sendOffer(peer.userId, offer.sdp!);
		} catch (e) {
			console.error('[PeerManager] Negotiation error:', e);
		} finally {
			peer.makingOffer = false;
		}
	}

	// ── Peer Creation ───────────────────────────────────────────

	private createPeer(userId: id): PeerConnection {
		const connection = new RTCPeerConnection({ iceServers: this.config.iceServers });

		const peer: PeerConnection = {
			connection: markRaw(connection),
			userId,
			remoteStream: markRaw(new MediaStream()),
			state: PeerState.New,
			makingOffer: false,
			ignoreOffer: false,
			isSettingRemoteAnswerPending: false,
		};

		this.setupHandlers(userId, connection, peer);
		return peer;
	}

	private setupTransceivers(peer: PeerConnection) {
		peer.connection.addTransceiver('audio', { direction: 'sendrecv' });
		peer.connection.addTransceiver('video', { direction: 'sendrecv' });
		peer.connection.addTransceiver('video', { direction: 'sendrecv' }); // screen
	}

	// ── Event Handlers ──────────────────────────────────────────

	private setupHandlers(userId: id, connection: RTCPeerConnection, peer: PeerConnection) {
		connection.onicecandidate = (event) => {
			if (this.pcs.get(userId)?.connection !== connection) return;
			if (event.candidate) {
				this.signaling.sendIceCandidate(userId, event.candidate.toJSON());
			}
		};

		connection.onnegotiationneeded = async () => {
			if (this.pcs.get(userId)?.connection !== connection) return;
			await this.negotiate(peer);
		};

		connection.ontrack = (event) => {
			if (this.pcs.get(userId)?.connection !== connection) return;
			peer.remoteStream.addTrack(event.track);
			this.onTrackReceived?.(userId, event.track, connection);
			this.onStateChange?.();
		};

		connection.onconnectionstatechange = () => {
			if (this.pcs.get(userId)?.connection !== connection) return;

			switch (connection.connectionState) {
				case 'connected':
					peer.state = PeerState.Connected;
					this.clearConnectionTimeout(userId);
					this.iceRestartCounts.delete(userId);
					this.onPeerConnected?.(userId);
					break;
				case 'disconnected':
					peer.state = PeerState.Disconnected;
					this.scheduleIceRestart(userId);
					break;
				case 'failed':
					peer.state = PeerState.Failed;
					this.attemptIceRestart(userId);
					break;
				case 'closed':
					peer.state = PeerState.Closed;
					this.removePeerConnection(userId);
					break;
			}

			this.onStateChange?.();
		};

		connection.oniceconnectionstatechange = () => {
			if (this.pcs.get(userId)?.connection !== connection) return;
			if (connection.iceConnectionState === 'failed') {
				this.attemptIceRestart(userId);
			}
			this.onStateChange?.();
		};
	}

	// ── Connection Timeout ──────────────────────────────────────

	private startConnectionTimeout(userId: id) {
		this.clearConnectionTimeout(userId);
		const timer = window.setTimeout(() => {
			const peer = this.pcs.get(userId);
			if (peer && peer.state !== PeerState.Connected) {
				console.warn(`[PeerManager] Connection timeout for user ${userId}`);
				this.attemptIceRestart(userId);
			}
		}, this.config.connectionTimeoutMs);
		this.connectionTimers.set(userId, timer);
	}

	private clearConnectionTimeout(userId: id) {
		const timer = this.connectionTimers.get(userId);
		if (timer) {
			clearTimeout(timer);
			this.connectionTimers.delete(userId);
		}
	}

	// ── ICE Restart ─────────────────────────────────────────────

	private scheduleIceRestart(userId: id) {
		window.setTimeout(() => {
			const peer = this.pcs.get(userId);
			if (peer && peer.connection.connectionState === 'disconnected') {
				this.attemptIceRestart(userId);
			}
		}, this.config.iceRestartDelayMs);
	}

	private async attemptIceRestart(userId: id) {
		const peer = this.pcs.get(userId);
		if (!peer) return;

		const count = (this.iceRestartCounts.get(userId) || 0) + 1;
		if (count > this.config.maxIceRestarts) {
			console.error(`[PeerManager] Max ICE restarts (${this.config.maxIceRestarts}) reached for user ${userId}`);
			this.removePeerConnection(userId);
			return;
		}

		this.iceRestartCounts.set(userId, count);
		console.log(`[PeerManager] ICE restart ${count}/${this.config.maxIceRestarts} for user ${userId}`);

		try {
			peer.makingOffer = true;
			const offer = await peer.connection.createOffer({ iceRestart: true });
			await peer.connection.setLocalDescription(offer);
			this.signaling.sendOffer(userId, offer.sdp!);
			this.startConnectionTimeout(userId);
		} catch (e) {
			console.error('[PeerManager] ICE restart error:', e);
		} finally {
			peer.makingOffer = false;
		}
	}

	// ── Track Injection (called by MediaManager via facade) ─────

	/** Callback set by facade to inject local tracks into incoming peer */
	onInjectLocalTracks: ((peer: PeerConnection) => void) | null = null;

	private injectLocalTracksIfNeeded(peer: PeerConnection) {
		this.onInjectLocalTracks?.(peer);
	}

	injectTrack(track: MediaStreamTrack | null, mediaIndex: number) {
		for (const peer of this.pcs.values()) {
			const transceivers = peer.connection.getTransceivers();
			if (transceivers[mediaIndex]) {
				transceivers[mediaIndex].sender.replaceTrack(track);
			}
		}
	}

	getTransceiverTrack(userId: id, mediaIndex: number): MediaStreamTrack | undefined {
		const peer = this.pcs.get(userId);
		if (!peer) return undefined;
		return peer.connection.getTransceivers()[mediaIndex]?.receiver.track;
	}

	// ── Public API ──────────────────────────────────────────────

	removePeerConnection(userId: id) {
		const peer = this.pcs.get(userId);
		if (peer) {
			peer.connection.close();
			this.pcs.delete(userId);
		}
		this.clearConnectionTimeout(userId);
		this.iceRestartCounts.delete(userId);
		this.signaling.clearPending(userId);
		this.onPeerRemoved?.(userId);
		this.onStateChange?.();
	}

	disconnectAll() {
		for (const userId of Array.from(this.pcs.keys())) {
			const peer = this.pcs.get(userId);
			if (peer) {
				peer.connection.close();
				this.pcs.delete(userId);
			}
			this.clearConnectionTimeout(userId);
		}
		this.iceRestartCounts.clear();
		this.signaling.clearAll();
	}
}
