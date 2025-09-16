import { websocketService } from './websocket';
import { MessageType } from '@/types';
import { useUserStore } from '@/stores/user';
import type { User } from '@/types';

type PeerConnectionState = 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed';
type MediaType = 'audio' | 'video' | 'both' | 'none';

interface PeerConnection {
	connection: RTCPeerConnection;
	stream?: MediaStream;
	userId: string;
}

export interface Channel {
	id: string;
	name: string;
	users: string[];
}

class WebRTCService {
	private static instance: WebRTCService;
	private peerConnections: Map<string, PeerConnection> = new Map();
	private localStream?: MediaStream;
	private readonly user: User;
	private readonly configuration: RTCConfiguration = {
		iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
	};

	private constructor() {
		this.user = useUserStore().user!;
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
				switch (message.data.action) {
					case 'offer':
						await this.handleOffer(message.from, message.data.offer);
						break;
					case 'answer':
						await this.handleAnswer(message.from, message.data.answer);
						break;
					case 'ice-candidate':
						await this.handleIceCandidate(message.from, message.data.candidate);
						break;
				}
			}
		});
	}

	createPeerConnection(userId: string) {
		if (this.peerConnections.has(userId)) {
			console.warn(`Peer connection with ${userId} already exists`);
			return;
		}

		const peerConnection = new RTCPeerConnection(this.configuration);
		this.peerConnections.set(userId, { connection: peerConnection, userId });

		this.setupPeerConnectionHandlers(userId, peerConnection);
	}

	private setupPeerConnectionHandlers(userId: string, peerConnection: RTCPeerConnection) {
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
			console.log(`Connection state change: ${peerConnection.connectionState}`);
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

		channel.users.forEach((id) => this.startPeerConnection(id));
	}

	async startPeerConnection(userId: string): Promise<void> {
		this.createPeerConnection(userId);
		const peerConnection = this.peerConnections.get(userId)?.connection;

		if (!peerConnection || !this.localStream) return;

		this.localStream.getTracks().forEach((track) => {
			peerConnection.addTrack(track, this.localStream!);
		});
		this.peerConnections.get(userId)!.stream = this.localStream;

		const offer = await peerConnection.createOffer();
		await peerConnection.setLocalDescription(offer);

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

		websocketService.sendMessage({
			type: MessageType.Server,
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

	private async handleOffer(userId: string, offer: RTCSessionDescriptionInit) {
		this.createPeerConnection(userId);
		const peerConnection = this.peerConnections.get(userId)?.connection;

		if (!peerConnection) return;

		await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
		const answer = await peerConnection.createAnswer();
		await peerConnection.setLocalDescription(answer);

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

	private async handleAnswer(userId: string, answer: RTCSessionDescriptionInit) {
		const peerConnection = this.peerConnections.get(userId)?.connection;
		if (peerConnection) {
			await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
		}
	}

	private async handleIceCandidate(userId: string, candidate: RTCIceCandidateInit) {
		const peerConnection = this.peerConnections.get(userId)?.connection;
		if (peerConnection) {
			await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
		}
	}

	private handleConnectionStateChange(userId: string, state: PeerConnectionState) {
		switch (state) {
			case 'connected':
				console.log(`Connected to peer ${userId}`);
				break;
			case 'disconnected':
				console.log(`Disconnected from peer ${userId}`);
				this.cleanupPeerConnection(userId);
				break;
			case 'failed':
				console.log(`Connection with peer ${userId} lost`);
				this.cleanupPeerConnection(userId);
				break;
			case 'closed':
				console.log(`Connection with peer ${userId} closed`);
				this.cleanupPeerConnection(userId);
				break;
		}
	}

	addStream(userId: string, stream: MediaStream) {
		const peer = this.peerConnections.get(userId);
		if (peer?.connection) {
			stream.getTracks().forEach((track) => peer.connection.addTrack(track, stream));
			peer.stream = stream;
		}
	}

	removeStream(userId: string) {
		const peer = this.peerConnections.get(userId);
		if (peer?.stream) {
			peer.stream.getTracks().forEach((track) => track.stop());
			peer.stream = undefined;
		}
	}

	disconnectPeer(userId: string) {
		this.cleanupPeerConnection(userId);
	}

	disconnectAll() {
		this.stopLocalStream();
		this.peerConnections.forEach((peer) => this.cleanupPeerConnection(peer.userId));
	}

	private cleanupPeerConnection(userId: string) {
		const peer = this.peerConnections.get(userId);
		if (peer) {
			if (peer.stream) {
				peer.stream.getTracks().forEach((track) => track.stop());
			}
			peer.connection.close();
			this.peerConnections.delete(userId);
		}
	}

	getPeerConnectionState(userId: string): PeerConnectionState | undefined {
		return this.peerConnections.get(userId)?.connection.connectionState as PeerConnectionState;
	}

	getAllPeerStates(): Map<string, PeerConnectionState> {
		const states = new Map<string, PeerConnectionState>();
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
