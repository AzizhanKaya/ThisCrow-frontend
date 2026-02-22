import { websocketService } from './websocket';
import { MessageType } from '@/types';
import { useMeStore } from '@/stores/me';
import type { User, id } from '@/types';

type PeerConnectionState = 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed';
type MediaType = 'audio' | 'video' | 'both' | 'none';

interface PeerConnection {
	connection: RTCPeerConnection;
	stream?: MediaStream;
	userId: id;
}

export interface Channel {
	id: id;
	name: string;
	users: id[];
}

class WebRTCService {
	private static instance: WebRTCService;
	private peerConnections: Map<id, PeerConnection> = new Map();
	private localStream?: MediaStream;
	private readonly user: User;
	private readonly configuration: RTCConfiguration = {
		iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
	};

	private constructor() {
		this.user = useMeStore().user!;
		this.setupWebSocketHandlers();
	}

	public static getInstance(): WebRTCService {
		if (!WebRTCService.instance) {
			WebRTCService.instance = new WebRTCService();
		}
		return WebRTCService.instance;
	}

	private setupWebSocketHandlers() {
		websocketService.onMessage(MessageType.Info, async (message) => {
			if (message.data.type === 'webrtc') {
				const fromId = message.from as unknown as id;
				switch (message.data.action) {
					case 'offer':
						await this.handleOffer(fromId, message.data.offer);
						break;
					case 'answer':
						await this.handleAnswer(fromId, message.data.answer);
						break;
					case 'ice-candidate':
						await this.handleIceCandidate(fromId, message.data.candidate);
						break;
				}
			}
		});
	}

	createPeerConnection(userId: id) {
		if (this.peerConnections.has(userId)) {
			console.warn(`Peer connection with ${userId} already exists`);
			return;
		}

		const peerConnection = new RTCPeerConnection(this.configuration);
		this.peerConnections.set(userId, { connection: peerConnection, userId });

		this.setupPeerConnectionHandlers(userId, peerConnection);
	}

	private setupPeerConnectionHandlers(userId: id, peerConnection: RTCPeerConnection) {
		peerConnection.onicecandidate = (event) => {
			if (event.candidate) {
				websocketService.sendMessage({
					type: MessageType.Info,
					from: this.user.id,
					to: userId,
					data: {
						type: 'webrtc',
						action: 'ice-candidate',
						candidate: event.candidate,
					},
					time: new Date(),
				});
			}
		};

		peerConnection.onconnectionstatechange = () => {
			this.handleConnectionStateChange(userId, peerConnection.connectionState as PeerConnectionState);
		};
	}

	async startLocalStream(mediaType: MediaType = 'both'): Promise<MediaStream | undefined> {
		try {
			const constraints: MediaStreamConstraints = {
				audio: mediaType === 'audio' || mediaType === 'both',
				video: mediaType === 'video' || mediaType === 'both',
			};

			const stream = await navigator.mediaDevices.getUserMedia(constraints);
			this.localStream = stream;
			return stream;
		} catch (error) {
			console.error('Error accessing media devices:', error);
			throw error;
		}
	}

	stopLocalStream() {
		if (this.localStream) {
			this.localStream.getTracks().forEach((track) => track.stop());
			this.localStream = undefined;
		}
	}

	async joinChannel(channel: Channel, mediaType: MediaType = 'both'): Promise<void> {
		if (!this.localStream) {
			this.localStream = await this.startLocalStream(mediaType);
		}

		channel.users.forEach((userId) => {
			if (userId !== this.user.id) {
				this.startPeerConnection(userId);
			}
		});
	}

	async startPeerConnection(userId: id): Promise<void> {
		this.createPeerConnection(userId);
		const peer = this.peerConnections.get(userId);

		if (!peer || !this.localStream) return;

		this.localStream.getTracks().forEach((track) => {
			peer.connection.addTrack(track, this.localStream!);
		});
		peer.stream = this.localStream;

		const offer = await peer.connection.createOffer();
		await peer.connection.setLocalDescription(offer);

		websocketService.sendMessage({
			type: MessageType.Info,
			from: this.user.id,
			to: userId,
			data: {
				type: 'webrtc',
				action: 'offer',
				offer,
			},
			time: new Date(),
		});
	}

	private async handleOffer(userId: id, offer: RTCSessionDescriptionInit) {
		this.createPeerConnection(userId);
		const peer = this.peerConnections.get(userId);

		if (!peer) return;

		await peer.connection.setRemoteDescription(new RTCSessionDescription(offer));
		const answer = await peer.connection.createAnswer();
		await peer.connection.setLocalDescription(answer);

		websocketService.sendMessage({
			type: MessageType.Info,
			from: this.user.id,
			to: userId,
			data: {
				type: 'webrtc',
				action: 'answer',
				answer,
			},
			time: new Date(),
		});
	}

	private async handleAnswer(userId: id, answer: RTCSessionDescriptionInit) {
		const peer = this.peerConnections.get(userId);
		if (peer) {
			await peer.connection.setRemoteDescription(new RTCSessionDescription(answer));
		}
	}

	private async handleIceCandidate(userId: id, candidate: RTCIceCandidateInit) {
		const peer = this.peerConnections.get(userId);
		if (peer) {
			await peer.connection.addIceCandidate(new RTCIceCandidate(candidate));
		}
	}

	private handleConnectionStateChange(userId: id, state: PeerConnectionState) {
		switch (state) {
			case 'disconnected':
			case 'failed':
			case 'closed':
				this.cleanupPeerConnection(userId);
				break;
		}
	}

	addStream(userId: id, stream: MediaStream) {
		const peer = this.peerConnections.get(userId);
		if (peer?.connection) {
			stream.getTracks().forEach((track) => peer.connection.addTrack(track, stream));
			peer.stream = stream;
		}
	}

	removeStream(userId: id) {
		const peer = this.peerConnections.get(userId);
		if (peer?.stream) {
			peer.stream.getTracks().forEach((track) => track.stop());
			peer.stream = undefined;
		}
	}

	disconnectPeer(userId: id) {
		this.cleanupPeerConnection(userId);
	}

	disconnectAll() {
		this.stopLocalStream();
		this.peerConnections.forEach((_peer, userId) => this.cleanupPeerConnection(userId));
	}

	private cleanupPeerConnection(userId: id) {
		const peer = this.peerConnections.get(userId);
		if (peer) {
			if (peer.stream) {
				peer.stream.getTracks().forEach((track) => track.stop());
			}
			peer.connection.close();
			this.peerConnections.delete(userId);
		}
	}

	getPeerConnectionState(userId: id): PeerConnectionState | undefined {
		return this.peerConnections.get(userId)?.connection.connectionState as PeerConnectionState;
	}

	getAllPeerStates(): Map<id, PeerConnectionState> {
		const states = new Map<id, PeerConnectionState>();
		this.peerConnections.forEach((peer, userId) => {
			states.set(userId, peer.connection.connectionState as PeerConnectionState);
		});
		return states;
	}

	getLocalStream(): MediaStream | undefined {
		return this.localStream;
	}

	toggleAudio(enabled: boolean) {
		if (this.localStream) {
			this.localStream.getAudioTracks().forEach((track) => {
				track.enabled = enabled;
			});
		}
	}

	toggleVideo(enabled: boolean) {
		if (this.localStream) {
			this.localStream.getVideoTracks().forEach((track) => {
				track.enabled = enabled;
			});
		}
	}
}

export const getWebRTCService = () => WebRTCService.getInstance();

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
