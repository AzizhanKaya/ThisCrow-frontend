import { websocketService } from './websocket';
import { EventType, MessageType, type Event } from '@/types';
import { useMeStore } from '@/stores/me';
import { useVoiceStore } from '@/stores/voice';
import type { User, id } from '@/types';
import { generate_uid } from '@/utils/uid';
import { markRaw, reactive, ref } from 'vue';
import { encode } from '@/utils/msgpack';

export enum MediaType {
	Audio = 'audio',
	Video = 'video',
	Screen = 'screen',
}

interface PeerConnection {
	connection: RTCPeerConnection;
	remoteStream?: MediaStream;
	userId: id;
}

class WebRTCService {
	private static instance: WebRTCService;
	public pcs: Map<id, PeerConnection> = reactive(new Map());
	public stateUpdate = ref(0);
	public activeTracks = reactive(new Set<string>());
	localStream?: MediaStream;
	private localTrackIds = new Map<MediaType, string>();
	private hardwareTracks = new Map<MediaType, MediaStreamTrack>();
	private audioContext?: AudioContext;
	private audioProcessor?: number;
	public speakingUsers = reactive(new Set<id>());
	public inputLevel = ref(0);
	public latencyMs = ref(0);
	private latencyInterval?: number;
	private get me(): User | null | undefined {
		return useMeStore().me;
	}
	private readonly configuration: RTCConfiguration = {
		iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
	};

	public setupTrackListeners(track: MediaStreamTrack) {
		if ((track as any)._hasMuteListener) return;
		(track as any)._hasMuteListener = true;

		if (!track.muted) {
			this.activeTracks.add(track.id);
		}

		track.addEventListener('mute', () => {
			this.activeTracks.delete(track.id);
		});

		track.addEventListener('unmute', () => {
			this.activeTracks.add(track.id);
		});

		track.addEventListener('ended', () => {
			this.activeTracks.delete(track.id);
		});
	}

	private constructor() {
		this.setupWebSocketHandlers();
	}

	public static getInstance(): WebRTCService {
		if (!WebRTCService.instance) WebRTCService.instance = new WebRTCService();
		return WebRTCService.instance;
	}

	private setupWebSocketHandlers() {
		websocketService.onMessage<Event>(MessageType.Info, async (message) => {
			const { from, data } = message;

			switch (data.event) {
				case EventType.Offer:
					await this.handleOffer(from, data.payload);
					break;
				case EventType.Answer:
					await this.handleAnswer(from, data.payload);
					break;
				case EventType.IceCandidate:
					await this.handleIceCandidate(from, data.payload);
					break;
			}
		});
	}

	private injectLocalTracks(peer: PeerConnection) {
		if (this.localStream) {
			const tracks = this.localStream.getTracks();
			const audioTrack = tracks.find((t) => t.id === this.localTrackIds.get(MediaType.Audio));
			const videoTrack = tracks.find((t) => t.id === this.localTrackIds.get(MediaType.Video));
			const screenTrack = tracks.find((t) => t.id === this.localTrackIds.get(MediaType.Screen));

			const transceivers = peer.connection.getTransceivers();
			if (audioTrack && transceivers[0]) transceivers[0].sender.replaceTrack(audioTrack);
			if (videoTrack && transceivers[1]) transceivers[1].sender.replaceTrack(videoTrack);
			if (screenTrack && transceivers[2]) transceivers[2].sender.replaceTrack(screenTrack);
		}
	}

	private setupTransceivers(peer: PeerConnection) {
		peer.connection.addTransceiver('audio', { direction: 'sendrecv' });
		peer.connection.addTransceiver('video', { direction: 'sendrecv' });
		peer.connection.addTransceiver('video', { direction: 'sendrecv' });
		this.injectLocalTracks(peer);
	}

	private createPeer(userId: id): PeerConnection {
		const connection = new RTCPeerConnection(this.configuration);

		const peer: PeerConnection = {
			connection: markRaw(connection),
			userId,
			remoteStream: markRaw(new MediaStream()),
		};

		this.setupPeerConnectionHandlers(userId, connection);

		return peer;
	}

	private pendingOffers = new Map<id, string>();
	private pendingCandidates = new Map<id, RTCIceCandidateInit[]>();

	private async handleOffer(userId: id, sdp: string) {
		const voiceStore = useVoiceStore();

		const inDirectCall = voiceStore.voice_direct?.id === userId;
		const inServerCall = voiceStore.voice_channel && Array.from(voiceStore.voice_channel.users || []).some((u) => u.id === userId);
		const isTargetCall = inDirectCall || inServerCall;

		if (!isTargetCall) {
			this.pendingOffers.set(userId, sdp);
			return;
		}

		let peer = this.pcs.get(userId);
		if (!peer) {
			peer = this.createPeer(userId);
			this.pcs.set(userId, peer);
		}

		await peer.connection.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }));

		const candidates = this.pendingCandidates.get(userId) || [];
		for (const candidate of candidates) {
			try {
				await peer.connection.addIceCandidate(new RTCIceCandidate(candidate));
			} catch (e) {
				console.error('Pending ICE Candidate Error', e);
			}
		}
		this.pendingCandidates.delete(userId);

		peer.connection.getTransceivers().forEach((t) => {
			try {
				if (t.direction !== 'stopped') t.direction = 'sendrecv';
			} catch (e) {}
		});

		this.injectLocalTracks(peer);
		this.stateUpdate.value++;

		const answer = await peer.connection.createAnswer();
		await peer.connection.setLocalDescription(answer);

		websocketService.sendMessage({
			id: generate_uid(this.me!.id),
			type: MessageType.Info,
			from: this.me!.id,
			to: userId,
			data: { event: EventType.Answer, payload: answer.sdp! },
		});
	}

	private async handleAnswer(userId: id, sdp: string) {
		const peer = this.pcs.get(userId);
		if (peer && peer.connection.signalingState !== 'stable') {
			await peer.connection.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp }));

			const candidates = this.pendingCandidates.get(userId) || [];
			for (const candidate of candidates) {
				try {
					await peer.connection.addIceCandidate(new RTCIceCandidate(candidate));
				} catch (e) {
					console.error('Pending ICE Candidate Error', e);
				}
			}
			this.pendingCandidates.delete(userId);
		}
	}

	private async handleIceCandidate(userId: id, candidate: RTCIceCandidateInit) {
		const peer = this.pcs.get(userId);
		if (peer && peer.connection.remoteDescription) {
			await peer.connection.addIceCandidate(new RTCIceCandidate(candidate));
		} else {
			if (!this.pendingCandidates.has(userId)) {
				this.pendingCandidates.set(userId, []);
			}
			this.pendingCandidates.get(userId)!.push(candidate);
		}
	}

	public async connectPeers(userIds: id[]) {
		await Promise.all(
			userIds.map(async (userId) => {
				if (this.pcs.has(userId)) return;

				if (this.pendingOffers.has(userId)) {
					const sdp = this.pendingOffers.get(userId)!;
					this.pendingOffers.delete(userId);
					await this.handleOffer(userId, sdp);
					return;
				}

				const peer = this.createPeer(userId);
				this.pcs.set(userId, peer);

				if (this.me!.id > userId) {
					this.setupTransceivers(peer);
					const offer = await peer.connection.createOffer();
					await peer.connection.setLocalDescription(offer);
					websocketService.sendMessage({
						id: generate_uid(this.me!.id),
						type: MessageType.Info,
						from: this.me!.id,
						to: userId,
						data: { event: EventType.Offer, payload: offer.sdp! },
					});
				}
			})
		);
	}

	private setupPeerConnectionHandlers(userId: id, connection: RTCPeerConnection) {
		connection.onicecandidate = (event) => {
			const peer = this.pcs.get(userId);
			if (peer && peer.connection !== connection) return;

			if (event.candidate) {
				websocketService.sendMessage({
					id: generate_uid(this.me!.id),
					type: MessageType.Info,
					from: this.me!.id,
					to: userId,
					data: { event: EventType.IceCandidate, payload: event.candidate.toJSON() },
				});
			}
		};

		connection.ontrack = (event) => {
			const peer = this.pcs.get(userId);
			if (peer && peer.connection !== connection) return;

			this.stateUpdate.value++;
			if (peer && peer.remoteStream) {
				peer.remoteStream.addTrack(event.track);
			}
			this.setupTrackListeners(event.track);

			if (event.track.kind === 'audio') {
				this.monitorRemoteAudio(userId, event.track, connection);
			}
		};

		connection.onconnectionstatechange = () => {
			const peer = this.pcs.get(userId);
			if (peer && peer.connection !== connection) return;

			this.stateUpdate.value++;

			if (connection.connectionState === 'connected') {
				this.startLatencyPolling();
			}

			if (['disconnected', 'failed', 'closed'].includes(connection.connectionState)) {
				this.removePeerConnection(userId);
			}
		};
	}

	private monitorRemoteAudio(userId: id, track: MediaStreamTrack, connection: RTCPeerConnection) {
		if (!this.audioContext) {
			this.audioContext = new AudioContext();
		}

		const stream = new MediaStream([track]);
		const source = this.audioContext.createMediaStreamSource(stream);
		const analyser = this.audioContext.createAnalyser();

		source.connect(analyser);

		analyser.fftSize = 256;
		const bufferLength = analyser.fftSize;
		const dataArray = new Float32Array(bufferLength);

		let intervalId: number;
		let holdFrames = 0;
		const HOLD_DURATION = 5;

		const checkVolume = () => {
			const peer = this.pcs.get(userId);
			if (track.readyState === 'ended' || !peer || peer.connection !== connection) {
				this.speakingUsers.delete(userId);
				clearInterval(intervalId);
				return;
			}

			if (this.audioContext && this.audioContext.state === 'suspended') {
				this.audioContext.resume();
			}

			analyser.getFloatTimeDomainData(dataArray);
			let sum = 0;
			for (let i = 0; i < bufferLength; i++) {
				sum += dataArray[i] * dataArray[i];
			}
			const rms = Math.sqrt(sum / bufferLength);

			if (rms > 0.005) {
				this.speakingUsers.add(userId);
				holdFrames = HOLD_DURATION;
			} else {
				if (holdFrames > 0) {
					holdFrames--;
				} else {
					this.speakingUsers.delete(userId);
				}
			}
		};

		intervalId = window.setInterval(checkVolume, 100);
	}

	public async addTrack(type: MediaType, deviceId?: string) {
		if (!this.localStream) this.localStream = markRaw(new MediaStream());

		const voiceStore = useVoiceStore();
		const baseAudio: MediaTrackConstraints = deviceId ? { deviceId: deviceId } : {};
		if (voiceStore.noiseSuppression) {
			baseAudio.noiseSuppression = true;
			baseAudio.echoCancellation = true;
			baseAudio.autoGainControl = true;
		} else {
			baseAudio.noiseSuppression = false;
			baseAudio.echoCancellation = true;
			baseAudio.autoGainControl = false;
		}
		const audioConstraints: MediaTrackConstraints | boolean = Object.keys(baseAudio).length > 0 ? baseAudio : true;

		const constraints = {
			[MediaType.Audio]: { audio: audioConstraints },
			[MediaType.Video]: { video: true },
			[MediaType.Screen]: null,
		};

		let track: MediaStreamTrack;
		let hardwareTrack: MediaStreamTrack;

		if (type === MediaType.Screen) {
			const stream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true });
			track = stream.getVideoTracks()[0];
			hardwareTrack = track;
		} else {
			const stream = await navigator.mediaDevices.getUserMedia(constraints[type] as any);
			hardwareTrack = type === MediaType.Audio ? stream.getAudioTracks()[0] : stream.getVideoTracks()[0];

			if (type === MediaType.Audio) {
				if (!this.audioContext) {
					this.audioContext = new AudioContext();
				} else if (this.audioContext.state === 'suspended') {
					await this.audioContext.resume();
				}

				const source = this.audioContext.createMediaStreamSource(stream);
				const analyser = this.audioContext.createAnalyser();
				const gainNode = this.audioContext.createGain();
				const destination = this.audioContext.createMediaStreamDestination();

				source.connect(analyser);
				source.connect(gainNode);
				gainNode.connect(destination);

				analyser.fftSize = 512;
				const bufferLength = analyser.fftSize;
				const dataArray = new Float32Array(bufferLength);

				let holdFrames = 0;
				const HOLD_DURATION = 10;

				const checkVolume = () => {
					if (!this.audioContext || this.audioContext.state === 'closed') return;
					analyser.getFloatTimeDomainData(dataArray);

					let sum = 0;
					for (let i = 0; i < bufferLength; i++) {
						sum += dataArray[i] * dataArray[i];
					}
					const rms = Math.sqrt(sum / bufferLength);
					const normalizedLevel = Math.min(1, rms / 0.15);
					this.inputLevel.value = normalizedLevel;

					const threshold = voiceStore.voiceThreshold;

					if (rms > threshold) {
						gainNode.gain.setTargetAtTime(1, this.audioContext.currentTime, 0.05);
						holdFrames = HOLD_DURATION;
						if (this.me) this.speakingUsers.add(this.me.id);
					} else {
						if (holdFrames > 0) {
							holdFrames--;
							if (this.me) this.speakingUsers.add(this.me.id);
						} else {
							gainNode.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.1);
							if (this.me) this.speakingUsers.delete(this.me.id);
						}
					}
				};

				this.audioProcessor = window.setInterval(checkVolume, 50);
				checkVolume();
				track = destination.stream.getAudioTracks()[0];

				hardwareTrack.addEventListener('ended', () => {
					track.stop();
					track.dispatchEvent(new Event('ended'));
				});
			} else {
				track = hardwareTrack;
			}
		}

		this.localTrackIds.set(type, track.id);
		this.hardwareTracks.set(type, hardwareTrack);
		this.localStream.addTrack(track);

		const index = type === MediaType.Audio ? 0 : type === MediaType.Video ? 1 : 2;

		this.setupTrackListeners(track);

		this.pcs.forEach((peer) => {
			const transceivers = peer.connection.getTransceivers();
			if (transceivers[index]) {
				transceivers[index].sender.replaceTrack(track);
			}
		});

		return track;
	}

	public async removeTrack(type: MediaType) {
		const index = type === MediaType.Audio ? 0 : type === MediaType.Video ? 1 : 2;
		const trackId = this.localTrackIds.get(type);

		const track = this.localStream?.getTracks().find((t) => t.id === trackId);
		const hardwareTrack = this.hardwareTracks.get(type);

		if (track) {
			track.stop();
			this.localStream?.removeTrack(track);
			this.localTrackIds.delete(type);
		}

		if (hardwareTrack) {
			hardwareTrack.stop();
			this.hardwareTracks.delete(type);
		}

		if (type === MediaType.Audio && this.audioProcessor) {
			clearInterval(this.audioProcessor);
			this.audioProcessor = undefined;
			if (this.me) this.speakingUsers.delete(this.me.id);
		}

		this.pcs.forEach((peer) => {
			const transceivers = peer.connection.getTransceivers();
			if (transceivers[index]) {
				transceivers[index].sender.replaceTrack(null);
			}
		});
	}

	public getTrack(userId: id, type: MediaType): MediaStreamTrack | undefined {
		const _ = this.stateUpdate.value;

		if (this.me && userId === this.me.id) {
			const trackId = this.localTrackIds.get(type);
			return this.localStream?.getTracks().find((t) => t.id === trackId);
		}

		const peer = this.pcs.get(userId);
		if (!peer) return undefined;

		const index = type === MediaType.Audio ? 0 : type === MediaType.Video ? 1 : 2;
		return peer.connection.getTransceivers()[index]?.receiver.track;
	}

	public removePeerConnection(userId: id) {
		const peer = this.pcs.get(userId);
		if (peer) {
			peer.connection.close();
			this.pcs.delete(userId);
		}
	}

	public disconnectAll() {
		this.localStream?.getTracks().forEach((t) => t.stop());
		this.hardwareTracks.forEach((t) => t.stop());
		this.localStream = undefined;
		this.localTrackIds.clear();
		this.hardwareTracks.clear();

		const peerIds = Array.from(this.pcs.keys());
		peerIds.forEach((id) => this.removePeerConnection(id));

		if (this.audioProcessor) {
			clearInterval(this.audioProcessor);
			this.audioProcessor = undefined;
		}

		this.stopLatencyPolling();
		this.latencyMs.value = 0;
		this.speakingUsers.clear();
		this.activeTracks.clear();
		this.pendingOffers.clear();
		this.pendingCandidates.clear();
	}

	private startLatencyPolling() {
		if (this.latencyInterval) return;
		this.latencyInterval = window.setInterval(() => this.measureLatency(), 2000);
		this.measureLatency();
	}

	private stopLatencyPolling() {
		if (this.latencyInterval) {
			clearInterval(this.latencyInterval);
			this.latencyInterval = undefined;
		}
	}

	private async measureLatency() {
		const peers = Array.from(this.pcs.values());
		if (peers.length === 0) {
			this.latencyMs.value = 0;
			return;
		}

		let totalRtt = 0;
		let count = 0;

		for (const peer of peers) {
			try {
				const stats = await peer.connection.getStats();
				stats.forEach((report) => {
					if (
						report.type === 'candidate-pair' &&
						report.nominated === true &&
						report.state === 'succeeded' &&
						report.currentRoundTripTime != null
					) {
						totalRtt += report.currentRoundTripTime;
						count++;
					}
				});
			} catch {}
		}

		if (count > 0) {
			this.latencyMs.value = Math.max(1, Math.round((totalRtt / count) * 1000));
		}
	}
}

export const webrtcService: WebRTCService = new Proxy({} as WebRTCService, {
	get(_target, prop, _receiver) {
		const instance = WebRTCService.getInstance() as any;
		const value = instance[prop as keyof WebRTCService];
		if (typeof value === 'function') {
			return value.bind(instance);
		}
		return value;
	},
});

export type { WebRTCService };
