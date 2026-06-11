import { websocketService } from './websocket';
import { EventType, MessageType, type Event } from '@/types';
import { useMeStore } from '@/stores/me';
import { useVoiceStore } from '@/stores/voice';
import type { User, id } from '@/types';
import { generate_uid } from '@/utils/uid';
import { ICE_SERVERS, ICE_TRANSPORT_POLICY } from '@/constants';
import { markRaw, reactive, ref } from 'vue';

export enum MediaType {
	Audio = 'audio',
	Video = 'video',
	Screen = 'screen',
}

const DISCONNECT_TIMEOUT_MS = 5000;
const TRANSCEIVER_ORDER: MediaType[] = [MediaType.Audio, MediaType.Video, MediaType.Screen];

interface PeerConnection {
	connection: RTCPeerConnection;
	remoteStream: MediaStream;
	userId: id;
	transceivers: Map<MediaType, RTCRtpTransceiver>;
	makingOffer: boolean;
	isPolite: boolean;
	disconnectTimer?: number;
	audioCleanup?: () => void;
}

class WebRTCService {
	private static instance: WebRTCService;
	public pcs: Map<id, PeerConnection> = reactive(new Map());
	public stateUpdate = ref(0);

	localStream?: MediaStream;
	private localTrackIds = new Map<MediaType, string>();
	private hardwareTracks = new Map<MediaType, MediaStreamTrack>();
	private audioContext?: AudioContext;
	private audioProcessor?: number;
	private audioGraph?: {
		source: MediaStreamAudioSourceNode;
		analyser: AnalyserNode;
		gainNode: GainNode;
		destination: MediaStreamAudioDestinationNode;
	};
	public speakingUsers = reactive(new Set<id>());
	public inputLevel = ref(0);
	public latencyMs = ref(0);
	private latencyInterval?: number;
	private trackLocks: Map<MediaType, Promise<unknown>> = new Map();
	private sessionId = 0;
	public onPeerLost?: (userId: id) => void;
	private pendingOffers = new Map<id, string>();
	private pendingCandidates = new Map<id, RTCIceCandidateInit[]>();
	private get me(): User | null | undefined {
		return useMeStore().me;
	}
	private readonly configuration: RTCConfiguration = {
		iceServers: ICE_SERVERS,
		iceTransportPolicy: ICE_TRANSPORT_POLICY,
	};

	public static getInstance(): WebRTCService {
		if (!WebRTCService.instance) WebRTCService.instance = new WebRTCService();
		return WebRTCService.instance;
	}

	public setupWebSocketHandlers() {
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
		if (!this.localStream) return;
		for (const type of TRANSCEIVER_ORDER) {
			const trackId = this.localTrackIds.get(type);
			if (!trackId) continue;
			const track = this.localStream.getTracks().find((t) => t.id === trackId);
			const tx = peer.transceivers.get(type);
			if (track && tx) {
				tx.sender.replaceTrack(track).catch((e) => console.error('replaceTrack failed', e));
			}
		}
	}

	private setupTransceivers(peer: PeerConnection) {
		const audio = peer.connection.addTransceiver('audio', { direction: 'sendrecv' });
		const video = peer.connection.addTransceiver('video', { direction: 'sendrecv' });
		const screen = peer.connection.addTransceiver('video', { direction: 'sendrecv' });
		peer.transceivers.set(MediaType.Audio, audio);
		peer.transceivers.set(MediaType.Video, video);
		peer.transceivers.set(MediaType.Screen, screen);
		this.injectLocalTracks(peer);
	}

	private mapAnswererTransceivers(peer: PeerConnection) {
		const list = peer.connection.getTransceivers();
		TRANSCEIVER_ORDER.forEach((type, idx) => {
			const tx = list[idx];
			if (!tx) return;
			peer.transceivers.set(type, tx);
			if (tx.direction !== 'stopped' && tx.direction !== 'sendrecv') {
				try {
					tx.direction = 'sendrecv';
				} catch (e) {
					console.error('Failed to set transceiver direction', e);
				}
			}
		});
	}

	private createPeer(userId: id): PeerConnection {
		const connection = new RTCPeerConnection(this.configuration);

		const peer: PeerConnection = {
			connection: markRaw(connection),
			userId,
			remoteStream: markRaw(new MediaStream()),
			transceivers: new Map(),
			makingOffer: false,
			isPolite: (this.me?.id ?? 0) < userId,
		};

		this.setupPeerConnectionHandlers(userId, connection);

		return peer;
	}

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

		const offerCollision = peer.makingOffer || peer.connection.signalingState !== 'stable';
		const ignoreOffer = !peer.isPolite && offerCollision;
		if (ignoreOffer) {
			console.warn('Ignoring offer due to glare (impolite peer)', userId);
			return;
		}

		try {
			await peer.connection.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }));

			if (peer.transceivers.size === 0) {
				this.mapAnswererTransceivers(peer);
			}

			const candidates = this.pendingCandidates.get(userId) || [];
			for (const candidate of candidates) {
				try {
					await peer.connection.addIceCandidate(new RTCIceCandidate(candidate));
				} catch (e) {
					console.error('Pending ICE Candidate Error', e);
				}
			}
			this.pendingCandidates.delete(userId);

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
		} catch (e) {
			console.error('handleOffer failed', e);
			this.removePeerConnection(userId);
		}
	}

	private async handleAnswer(userId: id, sdp: string) {
		const peer = this.pcs.get(userId);
		if (!peer) return;
		if (peer.connection.signalingState !== 'have-local-offer') {
			console.warn('Ignoring answer in state', peer.connection.signalingState);
			return;
		}
		try {
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
		} catch (e) {
			console.error('handleAnswer failed', e);
			this.removePeerConnection(userId);
		}
	}

	private async handleIceCandidate(userId: id, candidate: RTCIceCandidateInit) {
		const peer = this.pcs.get(userId);
		if (peer && peer.connection.remoteDescription) {
			try {
				await peer.connection.addIceCandidate(new RTCIceCandidate(candidate));
			} catch (e) {
				console.error('addIceCandidate failed', e);
			}
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
					try {
						peer.makingOffer = true;
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
					} catch (e) {
						console.error('connectPeers offer failed', e);
						this.removePeerConnection(userId);
					} finally {
						peer.makingOffer = false;
					}
				}
			})
		);
	}

	private setupPeerConnectionHandlers(userId: id, connection: RTCPeerConnection) {
		connection.onicecandidate = (event) => {
			const peer = this.pcs.get(userId);
			if (!peer || peer.connection !== connection) return;

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
			if (!peer || peer.connection !== connection) return;

			this.stateUpdate.value++;
			peer.remoteStream.addTrack(event.track);

			event.track.onmute = () => {
				this.stateUpdate.value++;
			};
			event.track.onunmute = () => {
				this.stateUpdate.value++;
			};
			event.track.onended = () => {
				this.stateUpdate.value++;
			};

			if (event.track.kind === 'audio') {
				this.monitorRemoteAudio(peer, event.track);
			}
		};

		connection.onnegotiationneeded = async () => {
			const peer = this.pcs.get(userId);
			if (!peer || peer.connection !== connection) return;
			if (peer.makingOffer) return;

			try {
				peer.makingOffer = true;
				const offer = await connection.createOffer();
				if (connection.signalingState !== 'stable') return;
				await connection.setLocalDescription(offer);
				websocketService.sendMessage({
					id: generate_uid(this.me!.id),
					type: MessageType.Info,
					from: this.me!.id,
					to: userId,
					data: { event: EventType.Offer, payload: offer.sdp! },
				});
			} catch (e) {
				console.error('negotiationneeded offer failed', e);
			} finally {
				peer.makingOffer = false;
			}
		};

		connection.onconnectionstatechange = () => {
			const peer = this.pcs.get(userId);
			if (!peer || peer.connection !== connection) return;

			this.stateUpdate.value++;

			const state = connection.connectionState;

			if (state === 'connected') {
				this.startLatencyPolling();
				if (peer.disconnectTimer) {
					clearTimeout(peer.disconnectTimer);
					peer.disconnectTimer = undefined;
				}
			} else if (state === 'failed' || state === 'closed') {
				this.handlePeerLost(userId);
			} else if (state === 'disconnected') {
				if (!peer.disconnectTimer) {
					peer.disconnectTimer = window.setTimeout(() => {
						const current = this.pcs.get(userId);
						if (current && current.connection === connection && connection.connectionState === 'disconnected') {
							this.handlePeerLost(userId);
						}
					}, DISCONNECT_TIMEOUT_MS);
				}
			}
		};
	}

	private handlePeerLost(userId: id) {
		this.removePeerConnection(userId);
		try {
			this.onPeerLost?.(userId);
		} catch (e) {
			console.error('onPeerLost callback failed', e);
		}
	}

	private monitorRemoteAudio(peer: PeerConnection, track: MediaStreamTrack) {
		peer.audioCleanup?.();

		if (!this.audioContext || this.audioContext.state === 'closed') {
			this.audioContext = new AudioContext();
		}

		// Chromium needs the remote track to be consumed by an HTMLMediaElement for
		// createMediaStreamSource to produce real samples. GlobalVoiceOverlay.vue already
		// binds peer.remoteStream to an <audio> element, so the track is being decoded.
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
		const userId = peer.userId;

		const cleanup = () => {
			clearInterval(intervalId);
			try {
				source.disconnect();
			} catch {}
			try {
				analyser.disconnect();
			} catch {}
			this.speakingUsers.delete(userId);
			if (peer.audioCleanup === cleanup) {
				peer.audioCleanup = undefined;
			}
		};

		const checkVolume = () => {
			try {
				const currentPeer = this.pcs.get(userId);
				if (track.readyState === 'ended' || !currentPeer || currentPeer !== peer) {
					cleanup();
					return;
				}

				if (!this.audioContext || this.audioContext.state === 'closed') {
					cleanup();
					return;
				}

				if (this.audioContext.state === 'suspended') {
					this.audioContext.resume().catch(() => {});
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
			} catch (e) {
				console.error('remote checkVolume failed', e);
				cleanup();
			}
		};

		intervalId = window.setInterval(checkVolume, 100);
		peer.audioCleanup = cleanup;
	}

	public async addTrack(type: MediaType, deviceId?: string): Promise<MediaStreamTrack> {
		const prev = this.trackLocks.get(type);
		if (prev) {
			try {
				await prev;
			} catch {}
		}

		const sessionAtStart = this.sessionId;

		const run = async (): Promise<MediaStreamTrack> => {
			this.disposeLocalTrack(type);

			if (!this.localStream) this.localStream = markRaw(new MediaStream());

			const voiceStore = useVoiceStore();
			const baseAudio: MediaTrackConstraints = deviceId ? { deviceId: { exact: deviceId } } : {};
			baseAudio.echoCancellation = true;
			baseAudio.autoGainControl = false;
			baseAudio.noiseSuppression = { exact: voiceStore.noiseSuppression };
			console.log(voiceStore.noiseSuppression);
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
					if (!this.audioContext || this.audioContext.state === 'closed') {
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

					this.audioGraph = { source, analyser, gainNode, destination };

					analyser.fftSize = 512;
					const bufferLength = analyser.fftSize;
					const dataArray = new Float32Array(bufferLength);

					let holdFrames = 0;
					const HOLD_DURATION = 10;

					const checkVolume = () => {
						try {
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
						} catch (e) {
							console.error('local checkVolume failed', e);
						}
					};

					this.audioProcessor = window.setInterval(checkVolume, 50);
					checkVolume();
					track = destination.stream.getAudioTracks()[0];

					hardwareTrack.addEventListener('ended', () => {
						try {
							track.stop();
						} catch {}
					});
				} else {
					track = hardwareTrack;
				}
			}

			if (sessionAtStart !== this.sessionId) {
				try {
					hardwareTrack.stop();
				} catch {}
				try {
					track.stop();
				} catch {}
				throw new Error('Track acquisition cancelled by disconnect');
			}

			this.localTrackIds.set(type, track.id);
			this.hardwareTracks.set(type, hardwareTrack);
			this.localStream!.addTrack(track);

			this.pcs.forEach((peer) => {
				const tx = peer.transceivers.get(type);
				if (tx) {
					tx.sender.replaceTrack(track).catch((e) => console.error('replaceTrack failed', e));
					if (tx.direction === 'recvonly') {
						tx.direction = 'sendrecv';
					}
				}
			});

			return track;
		};

		const promise = run();
		this.trackLocks.set(type, promise);
		try {
			return await promise;
		} finally {
			if (this.trackLocks.get(type) === promise) this.trackLocks.delete(type);
		}
	}

	private disposeAudioGraph() {
		if (!this.audioGraph) return;
		try {
			this.audioGraph.source.disconnect();
		} catch {}
		try {
			this.audioGraph.analyser.disconnect();
		} catch {}
		try {
			this.audioGraph.gainNode.disconnect();
		} catch {}
		try {
			this.audioGraph.destination.disconnect();
		} catch {}
		this.audioGraph = undefined;
	}

	private disposeLocalTrack(type: MediaType) {
		const trackId = this.localTrackIds.get(type);
		const track = trackId ? this.localStream?.getTracks().find((t) => t.id === trackId) : undefined;
		const hardwareTrack = this.hardwareTracks.get(type);

		if (track) {
			try {
				track.stop();
			} catch {}
			try {
				this.localStream?.removeTrack(track);
			} catch {}
		}
		if (hardwareTrack && hardwareTrack !== track) {
			try {
				hardwareTrack.stop();
			} catch {}
		}
		this.localTrackIds.delete(type);
		this.hardwareTracks.delete(type);

		if (type === MediaType.Audio) {
			if (this.audioProcessor) {
				clearInterval(this.audioProcessor);
				this.audioProcessor = undefined;
			}
			this.disposeAudioGraph();
			this.inputLevel.value = 0;
			if (this.me) this.speakingUsers.delete(this.me.id);
		}
	}

	public async removeTrack(type: MediaType) {
		const prev = this.trackLocks.get(type);
		if (prev) {
			try {
				await prev;
			} catch {}
		}

		const run = async () => {
			this.disposeLocalTrack(type);

			this.pcs.forEach((peer) => {
				const tx = peer.transceivers.get(type);
				if (tx) {
					tx.sender.replaceTrack(null).catch((e) => console.error('replaceTrack(null) failed', e));
					tx.direction = 'recvonly';
				}
			});
		};

		const promise = run();
		this.trackLocks.set(type, promise);
		try {
			await promise;
		} finally {
			if (this.trackLocks.get(type) === promise) this.trackLocks.delete(type);
		}
	}

	public getTrack(userId: id, type: MediaType): MediaStreamTrack | undefined {
		const _ = this.stateUpdate.value;

		if (this.me && userId === this.me.id) {
			const trackId = this.localTrackIds.get(type);
			return this.localStream?.getTracks().find((t) => t.id === trackId);
		}

		const peer = this.pcs.get(userId);
		if (!peer) return undefined;

		return peer.transceivers.get(type)?.receiver.track;
	}

	public removePeerConnection(userId: id) {
		const peer = this.pcs.get(userId);
		if (peer) {
			if (peer.disconnectTimer) {
				clearTimeout(peer.disconnectTimer);
				peer.disconnectTimer = undefined;
			}
			peer.audioCleanup?.();
			try {
				peer.connection.close();
			} catch {}
			this.pcs.delete(userId);
		}
		this.pendingOffers.delete(userId);
		this.pendingCandidates.delete(userId);
	}

	public async disconnectAll() {
		this.sessionId++;

		this.localStream?.getTracks().forEach((t) => {
			try {
				t.stop();
			} catch {}
		});
		this.hardwareTracks.forEach((t) => {
			try {
				t.stop();
			} catch {}
		});
		this.localStream = undefined;
		this.localTrackIds.clear();
		this.hardwareTracks.clear();

		const peerIds = Array.from(this.pcs.keys());
		peerIds.forEach((id) => this.removePeerConnection(id));

		if (this.audioProcessor) {
			clearInterval(this.audioProcessor);
			this.audioProcessor = undefined;
		}

		this.disposeAudioGraph();

		this.stopLatencyPolling();
		this.latencyMs.value = 0;
		this.inputLevel.value = 0;
		this.speakingUsers.clear();

		this.pendingOffers.clear();
		this.pendingCandidates.clear();

		if (this.audioContext && this.audioContext.state !== 'closed') {
			try {
				await this.audioContext.close();
			} catch (e) {
				console.error('audioContext.close failed', e);
			}
		}
		this.audioContext = undefined;
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
	set(_target, prop, value) {
		const instance = WebRTCService.getInstance() as any;
		instance[prop as keyof WebRTCService] = value;
		return true;
	},
});

export type { WebRTCService };
