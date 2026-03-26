import { websocketService } from './websocket';
import { EventType, MessageType, type Event } from '@/types';
import { useMeStore } from '@/stores/me';
import type { Message, User, id } from '@/types';
import { generate_uid } from '@/utils/uid';
import { markRaw, reactive } from 'vue';

interface PeerConnection {
	connection: RTCPeerConnection;
	dataChannel?: RTCDataChannel;
	remoteStream?: MediaStream;
	userId: id;
	mediaTypes: Map<string, MediaType>;
}

export enum MediaType {
	Audio = 'audio',
	Video = 'video',
	Screen = 'screen',
}

class WebRTCService {
	private static instance: WebRTCService;
	private pcs: Map<id, PeerConnection> = reactive(new Map());
	localStream?: MediaStream;
	private localMediaTypes: Map<string, MediaType> = reactive(new Map());
	private readonly me: User;
	private readonly configuration: RTCConfiguration = {
		iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
	};

	private constructor() {
		this.me = useMeStore().me!;
		this.setupWebSocketHandlers();
	}

	public static getInstance(): WebRTCService {
		if (!WebRTCService.instance) {
			WebRTCService.instance = new WebRTCService();
		}
		return WebRTCService.instance;
	}

	private setupWebSocketHandlers() {
		websocketService.onMessage<Event>(MessageType.Info, async (message) => {
			try {
				const { from, data } = message;
				switch (data.event) {
					case EventType.Offer:
						await this.handleOffer(from, { sdp: data.payload, type: 'offer' } as RTCSessionDescriptionInit);
						break;
					case EventType.Answer:
						await this.handleAnswer(from, { sdp: data.payload, type: 'answer' } as RTCSessionDescriptionInit);
						break;
					case EventType.IceCandidate:
						const candidateObj = JSON.parse(data.payload);
						await this.handleIceCandidate(from, candidateObj as RTCIceCandidateInit);
						break;
				}
			} catch (error) {}
		});
	}

	private async handleOffer(userId: id, offer: RTCSessionDescriptionInit) {
		let peer = this.pcs.get(userId);
		let connection: RTCPeerConnection;

		if (peer) {
			connection = peer.connection;
		} else {
			connection = new RTCPeerConnection(this.configuration);
			peer = {
				connection: markRaw(connection),
				userId,
				mediaTypes: reactive(new Map<string, MediaType>()),
			};
			this.pcs.set(userId, peer);

			this.setupPeerConnectionHandlers(userId, connection);

			if (this.localStream) {
				this.localStream.getTracks().forEach((track) => {
					connection.addTrack(track, this.localStream!);
				});
			}
		}

		await connection.setRemoteDescription(new RTCSessionDescription(offer));

		const answer = await peer.connection.createAnswer();
		await peer.connection.setLocalDescription(answer);

		websocketService.sendMessage({
			id: generate_uid(this.me.id),
			type: MessageType.Info,
			from: this.me.id,
			to: userId,
			data: { event: EventType.Answer, payload: answer.sdp! },
		});
	}

	private async handleAnswer(userId: id, answer: RTCSessionDescriptionInit) {
		const peer = this.pcs.get(userId);
		if (peer) {
			await peer.connection.setRemoteDescription(new RTCSessionDescription(answer));
		}
	}

	private async handleIceCandidate(userId: id, candidate: RTCIceCandidateInit) {
		const peer = this.pcs.get(userId);
		if (peer) {
			await peer.connection.addIceCandidate(new RTCIceCandidate(candidate));
		}
	}

	public async connectPeers(userIds: id[]) {
		await Promise.all(
			userIds.map(async (userId) => {
				if (this.pcs.has(userId)) return;

				const connection = new RTCPeerConnection(this.configuration);

				this.setupPeerConnectionHandlers(userId, connection);

				const peer: PeerConnection = { connection: markRaw(connection), userId, mediaTypes: reactive(new Map<string, MediaType>()) };
				this.pcs.set(userId, peer);

				const dataChannel = connection.createDataChannel('media-metadata');
				this.handleDataChannel(userId, dataChannel);

				if (this.localStream) {
					this.localStream.getTracks().forEach((track) => {
						connection.addTrack(track, this.localStream!);
					});
				}

				const offer = await connection.createOffer();
				await connection.setLocalDescription(offer);

				websocketService.sendMessage({
					id: generate_uid(this.me.id),
					type: MessageType.Info,
					from: this.me.id,
					to: userId,
					data: { event: EventType.Offer, payload: offer.sdp! },
				});
			})
		);
	}

	private setupPeerConnectionHandlers(userId: id, connection: RTCPeerConnection) {
		connection.onicecandidate = (event) => {
			if (event.candidate) {
				websocketService.sendMessage({
					id: generate_uid(this.me.id),
					type: MessageType.Info,
					from: this.me.id,
					to: userId,
					data: { event: EventType.IceCandidate, payload: JSON.stringify(event.candidate.toJSON()) },
				});
			}
		};

		connection.ondatachannel = (event) => {
			this.handleDataChannel(userId, event.channel);
		};

		connection.ontrack = (event) => {
			const peer = this.pcs.get(userId);
			if (peer) {
				if (!peer.remoteStream) {
					peer.remoteStream = markRaw(new MediaStream());
				}
				peer.remoteStream.addTrack(event.track);
				this.pcs.set(userId, { ...peer });
			}
		};

		connection.onconnectionstatechange = () => {
			if (['disconnected', 'failed', 'closed'].includes(connection.connectionState)) {
				this.removePeerConnection(userId);
			}
		};
	}

	private handleDataChannel(userId: id, channel: RTCDataChannel) {
		const peer = this.pcs.get(userId);
		if (peer) peer.dataChannel = channel;

		channel.onmessage = (event) => {
			const data = JSON.parse(event.data);
			if (data.type === 'TRACK_META') {
				peer?.mediaTypes.set(data.mid, data.mediaType);
			} else if (data.type === 'TRACK_REMOVED') {
				peer?.mediaTypes.delete(data.mid);
			}

			if (peer) {
				this.pcs.set(userId, { ...peer });
			}
		};

		const sendMeta = () => {
			if (!peer) return;
			peer.connection.getTransceivers().forEach((tc) => {
				if (tc.sender.track && tc.mid !== null) {
					const mediaType = this.localMediaTypes.get(tc.sender.track.id);
					if (mediaType) {
						channel.send(
							JSON.stringify({
								type: 'TRACK_META',
								mid: tc.mid,
								mediaType,
							})
						);
					}
				}
			});
		};

		if (channel.readyState === 'open') {
			sendMeta();
		} else {
			channel.onopen = () => {
				sendMeta();
			};
		}
	}

	public async addTrack(type: MediaType) {
		if (!this.localStream) {
			this.localStream = markRaw(new MediaStream());
		}

		let track: MediaStreamTrack;

		if (type === 'audio') {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
			track = stream.getAudioTracks()[0];
		} else if (type === 'video') {
			const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
			track = stream.getVideoTracks()[0];
		} else if (type === 'screen') {
			const stream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true });
			track = stream.getVideoTracks()[0];
		} else {
			throw new Error('Unsupported media type');
		}

		this.localStream.addTrack(track);
		this.localMediaTypes.set(track.id, type);

		this.pcs.forEach(async (peer) => {
			const sender = peer.connection.addTrack(track, this.localStream!);

			try {
				const offer = await peer.connection.createOffer();
				await peer.connection.setLocalDescription(offer);

				if (peer.dataChannel && peer.dataChannel.readyState === 'open') {
					const tc = peer.connection.getTransceivers().find((t) => t.sender === sender);
					if (tc && tc.mid !== null) {
						peer.dataChannel.send(
							JSON.stringify({
								type: 'TRACK_META',
								mid: tc.mid,
								mediaType: type,
							})
						);
					}
				}

				websocketService.sendMessage({
					id: generate_uid(this.me.id),
					type: MessageType.Info,
					from: this.me.id,
					to: peer.userId,
					data: { event: EventType.Offer, payload: offer.sdp! },
				});
			} catch (e) {}
		});
	}

	public toggleTrack(type: MediaType, enabled: boolean) {
		this.localStream
			?.getTracks()
			.filter((t) => this.localMediaTypes.get(t.id) === type)
			.forEach((t) => (t.enabled = enabled));
	}

	public async removeTrack(type: MediaType) {
		if (!this.localStream) return;

		const tracksToRemove = this.localStream.getTracks().filter((t) => this.localMediaTypes.get(t.id) === type);

		for (const track of tracksToRemove) {
			track.stop();
			this.localStream.removeTrack(track);
			this.localMediaTypes.delete(track.id);

			this.pcs.forEach(async (peer) => {
				const sender = peer.connection.getSenders().find((s) => s.track === track);
				if (sender) {
					peer.connection.removeTrack(sender);

					if (peer.dataChannel && peer.dataChannel.readyState === 'open') {
						const tc = peer.connection.getTransceivers().find((t) => t.sender === sender);
						if (tc && tc.mid !== null) {
							peer.dataChannel.send(
								JSON.stringify({
									type: 'TRACK_REMOVED',
									mid: tc.mid,
								})
							);
						}
					}

					try {
						const offer = await peer.connection.createOffer();
						await peer.connection.setLocalDescription(offer);

						websocketService.sendMessage({
							id: generate_uid(this.me.id),
							type: MessageType.Info,
							from: this.me.id,
							to: peer.userId,
							data: { event: EventType.Offer, payload: offer.sdp! },
						});
					} catch (e) {}
				}
			});
		}
	}

	public disconnectAll() {
		this.stopLocalStream();
		this.pcs.forEach((_, id) => this.removePeerConnection(id));
	}

	public stopLocalStream() {
		this.localStream?.getTracks().forEach((t) => t.stop());
		this.localStream = undefined;
		this.localMediaTypes.clear();
	}

	public removePeerConnection(userId: id) {
		const peer = this.pcs.get(userId);
		if (peer) {
			if (peer.dataChannel) {
				peer.dataChannel.onmessage = null;
				peer.dataChannel.onopen = null;
				peer.dataChannel.onclose = null;
				if (peer.dataChannel.readyState !== 'closed') {
					peer.dataChannel.close();
				}
				peer.dataChannel = undefined;
			}

			peer.connection.onicecandidate = null;
			peer.connection.ontrack = null;
			peer.connection.onconnectionstatechange = null;
			peer.connection.ondatachannel = null;
			peer.connection.close();
			this.pcs.delete(userId);
		}
	}

	public getRemoteStream(userId: id) {
		return this.pcs.get(userId)?.remoteStream;
	}

	public getTrack(userId: id, type: MediaType): MediaStreamTrack | undefined {
		if (userId === this.me.id) {
			if (!this.localStream) return undefined;
			return this.localStream.getTracks().find((track) => this.localMediaTypes.get(track.id) === type);
		}

		const peer = this.pcs.get(userId);
		if (!peer) return undefined;

		let targetMid: string | undefined;
		for (const [mid, mediaType] of peer.mediaTypes.entries()) {
			if (mediaType === type) {
				targetMid = mid;
				break;
			}
		}

		if (targetMid !== undefined) {
			const tc = peer.connection.getTransceivers().find((t) => t.mid === targetMid);
			return tc?.receiver.track;
		}

		return undefined;
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
