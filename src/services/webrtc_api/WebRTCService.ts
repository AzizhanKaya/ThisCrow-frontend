import { ref } from 'vue';
import type { id } from '@/types';
import { useMeStore } from '@/stores/me';
import { useVoiceStore } from '@/stores/voice';
import { MediaType, DEFAULT_CONFIG, type WebRTCConfig, type PeerConnection } from './types';
import { SignalingHandler } from './SignalingHandler';
import { PeerManager } from './PeerManager';
import { MediaManager } from './MediaManager';
import { AudioAnalyzer } from './AudioAnalyzer';
import { LatencyMonitor } from './LatencyMonitor';

export class WebRTCService {
	private static instance: WebRTCService;

	private signaling: SignalingHandler;
	private peerMgr: PeerManager;
	private media: MediaManager;
	private audio: AudioAnalyzer;
	private latency: LatencyMonitor;

	// ── Public API (backward-compatible) ────────────────────────

	get pcs(): Map<id, PeerConnection> {
		return this.peerMgr.pcs;
	}

	public stateUpdate = ref(0);

	get activeTracks() {
		return this.media.activeTracks;
	}

	get speakingUsers() {
		return this.audio.speakingUsers;
	}

	get inputLevel() {
		return this.audio.inputLevel;
	}

	get latencyMs() {
		return this.latency.latencyMs;
	}

	// ── Constructor ��────────────────────────────────────────────

	private constructor(config: WebRTCConfig = DEFAULT_CONFIG) {
		this.signaling = new SignalingHandler(config.pendingBufferTtlMs);
		this.peerMgr = new PeerManager(this.signaling, config);
		this.media = new MediaManager(this.peerMgr);
		this.audio = new AudioAnalyzer(() => useMeStore().me?.id);
		this.latency = new LatencyMonitor(() => this.peerMgr.pcs, config.latencyPollIntervalMs);

		this.wireModules();
	}

	public static getInstance(): WebRTCService {
		if (!WebRTCService.instance) WebRTCService.instance = new WebRTCService();
		return WebRTCService.instance;
	}

	private wireModules() {
		this.peerMgr.onStateChange = () => {
			this.stateUpdate.value++;
		};

		this.peerMgr.onTrackReceived = (userId, track, connection) => {
			this.media.setupTrackListeners(track);
			if (track.kind === 'audio') {
				this.audio.monitorRemoteAudio(userId, track, connection);
			}
		};

		this.peerMgr.onPeerConnected = () => {
			this.latency.start();
		};

		this.peerMgr.onPeerRemoved = () => {
			if (this.peerMgr.pcs.size === 0) {
				this.latency.stop();
			}
		};

		this.peerMgr.onInjectLocalTracks = (peer) => {
			this.media.injectAllInto(peer);
		};
	}

	// ── Peer Management ─────────────────────────────────────────

	async connectPeers(userIds: id[]) {
		await this.peerMgr.connectPeers(userIds);
	}

	removePeerConnection(userId: id) {
		this.peerMgr.removePeerConnection(userId);
	}

	// ── Media ─────���─────────────────────────────────────────────

	async addTrack(type: MediaType, deviceId?: string): Promise<MediaStreamTrack> {
		if (type === MediaType.Audio) {
			return this.media.addTrack(type, deviceId, async (stream) => {
				const voiceStore = useVoiceStore();
				return this.audio.processLocalAudio(stream, () => voiceStore.voiceThreshold);
			});
		}
		return this.media.addTrack(type, deviceId);
	}

	async removeTrack(type: MediaType) {
		if (type === MediaType.Audio) {
			this.audio.stopLocalProcessor();
		}
		await this.media.removeTrack(type);
	}

	getTrack(userId: id, type: MediaType): MediaStreamTrack | undefined {
		const _ = this.stateUpdate.value; // reactivity dependency
		return this.media.getTrack(userId, type);
	}

	setupTrackListeners(track: MediaStreamTrack) {
		this.media.setupTrackListeners(track);
	}

	// ── Lifecycle ───────────────────────────────────────────────

	disconnectAll() {
		this.media.destroyAll();
		this.peerMgr.disconnectAll();
		this.audio.destroyAll();
		this.latency.stop();
		this.stateUpdate.value++;
	}
}
