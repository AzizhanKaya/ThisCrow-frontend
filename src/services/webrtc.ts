import { websocketService } from './websocket';
import { EventType, MessageType, type Event } from '@/types';
import { useMeStore } from '@/stores/me';
import type { Message, User, id } from '@/types';
import { generate_uid } from '@/utils/uid';
import { generate_snowflake } from '@/utils/snowflake';

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
	private pcs: Map<id, PeerConnection> = new Map();
	localStream?: MediaStream;
	private localMediaTypes: Map<string, MediaType> = new Map();
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
		websocketService.onMessage(MessageType.Info, async (message: Message<Event>) => {
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
						await this.handleIceCandidate(from, data.payload as RTCIceCandidateInit);
						break;
				}
			} catch (error) {
				console.error(error);
			}
		});
	}

	private async handleOffer(userId: id, offer: RTCSessionDescriptionInit) {
		const connection = new RTCPeerConnection(this.configuration);
		connection.setRemoteDescription(new RTCSessionDescription(offer));

		const peer: PeerConnection = {
			connection,
			userId,
			mediaTypes: new Map<string, MediaType>(),
		};

		this.pcs.set(userId, peer);

		this.setupPeerConnectionHandlers(userId, connection);

		if (this.localStream) {
			this.localStream.getTracks().forEach((track) => {
				connection.addTrack(track, this.localStream!);
			});
		}

		const answer = await peer.connection.createAnswer();
		await peer.connection.setLocalDescription(answer);

		websocketService.sendMessage({
			id: generate_snowflake(),
			type: MessageType.Info,
			from: this.me.id,
			to: userId,
			data: { event: EventType.Answer, payload: answer.sdp },
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

	public async initPeerConnections(userIds: id[]) {
		this.disconnectAll();

		await Promise.all(
			userIds.map(async (userId) => {
				const connection = new RTCPeerConnection(this.configuration);

				const dataChannel = connection.createDataChannel('media-metadata');
				this.handleDataChannel(userId, dataChannel);

				this.setupPeerConnectionHandlers(userId, connection);

				const peer: PeerConnection = { connection, userId, mediaTypes: new Map<string, MediaType>() };
				this.pcs.set(userId, peer);

				const offer = await connection.createOffer();
				await connection.setLocalDescription(offer);

				websocketService.sendMessage({
					id: generate_snowflake(),
					type: MessageType.Info,
					from: this.me.id,
					to: userId,
					data: { event: EventType.Offer, payload: offer.sdp },
				});
			})
		);
	}

	private setupPeerConnectionHandlers(userId: id, connection: RTCPeerConnection) {
		connection.onicecandidate = (event) => {
			if (event.candidate) {
				websocketService.sendMessage({
					id: generate_snowflake(),
					type: MessageType.Info,
					from: this.me.id,
					to: userId,
					data: { event: EventType.IceCandidate, payload: event.candidate },
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
					peer.remoteStream = new MediaStream();
				}
				peer.remoteStream.addTrack(event.track);
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
				peer?.mediaTypes.set(data.trackId, data.mediaType);
			}
		};
	}

	public async addTrack(type: MediaType) {
		if (!this.localStream) {
			this.localStream = new MediaStream();
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

		this.pcs.forEach((peer) => {
			peer.connection.addTrack(track, this.localStream!);

			if (peer.dataChannel && peer.dataChannel.readyState === 'open') {
				peer.dataChannel.send(
					JSON.stringify({
						type: 'TRACK_META',
						trackId: track.id,
						mediaType: type,
					})
				);
			}
		});
	}

	public toggleTrack(type: MediaType, enabled: boolean) {
		this.localStream
			?.getTracks()
			.filter((t) => this.localMediaTypes.get(t.id) === type)
			.forEach((t) => (t.enabled = enabled));
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
		if (!peer || !peer.remoteStream) return undefined;

		return peer.remoteStream.getTracks().find((track) => peer.mediaTypes.get(track.id) === type);
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
