import { websocketService } from './websocket';
import { EventType, MessageType, type Event } from '@/types';
import { useMeStore } from '@/stores/me';
import type { User, id } from '@/types';
import { generate_uid } from '@/utils/uid';
import { markRaw, reactive, ref } from 'vue';

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
	private get me(): User | null | undefined {
		return useMeStore().me;
	}
	private readonly configuration: RTCConfiguration = {
		iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
	};

	public setupTrackListeners(track: MediaStreamTrack) {
		if ((track as any)._hasMuteListener) return;
		(track as any)._hasMuteListener = true;

		console.log(`[Track] Setting up listeners for ${track.kind} track ${track.id}. Initial muted state: ${track.muted}`);

		if (!track.muted) {
			this.activeTracks.add(track.id);
		}

		track.addEventListener('mute', () => {
			console.log(`[Track] mute event on ${track.kind} track ${track.id}`);
			this.activeTracks.delete(track.id);
		});

		track.addEventListener('unmute', () => {
			console.log(`[Track] unmute event on ${track.kind} track ${track.id}`);
			this.activeTracks.add(track.id);
		});

		track.addEventListener('ended', () => {
			console.log(`[Track] ended event on ${track.kind} track ${track.id}`);
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
					await this.handleOffer(from, JSON.parse(data.payload).sdp);
					break;
				case EventType.Answer:
					await this.handleAnswer(from, JSON.parse(data.payload).sdp);
					break;
				case EventType.IceCandidate:
					await this.handleIceCandidate(from, JSON.parse(data.payload));
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

	private async handleOffer(userId: id, sdp: string) {
		let peer = this.pcs.get(userId);
		if (!peer) {
			peer = this.createPeer(userId);
			this.pcs.set(userId, peer);
		}

		await peer.connection.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }));

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
			data: { event: EventType.Answer, payload: JSON.stringify({ sdp: answer.sdp }) },
		});
	}

	private async handleAnswer(userId: id, sdp: string) {
		const peer = this.pcs.get(userId);
		if (peer && peer.connection.signalingState !== 'stable') {
			await peer.connection.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp }));
		}
	}

	private async handleIceCandidate(userId: id, candidate: RTCIceCandidateInit) {
		const peer = this.pcs.get(userId);
		if (peer) await peer.connection.addIceCandidate(new RTCIceCandidate(candidate));
	}

	public async connectPeers(userIds: id[]) {
		for (const userId of userIds) {
			if (this.pcs.has(userId)) continue;

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
					data: { event: EventType.Offer, payload: JSON.stringify({ sdp: offer.sdp }) },
				});
			}
		}
	}

	private setupPeerConnectionHandlers(userId: id, connection: RTCPeerConnection) {
		connection.onicecandidate = (event) => {
			if (event.candidate) {
				websocketService.sendMessage({
					id: generate_uid(this.me!.id),
					type: MessageType.Info,
					from: this.me!.id,
					to: userId,
					data: { event: EventType.IceCandidate, payload: JSON.stringify(event.candidate.toJSON()) },
				});
			}
		};

		connection.ontrack = (event) => {
			this.stateUpdate.value++;
			const peer = this.pcs.get(userId);
			if (peer && peer.remoteStream) {
				peer.remoteStream.addTrack(event.track);
			}
			this.setupTrackListeners(event.track);
		};

		connection.onconnectionstatechange = () => {
			if (['disconnected', 'failed', 'closed'].includes(connection.connectionState)) {
				this.removePeerConnection(userId);
			}
		};
	}

	public async addTrack(type: MediaType) {
		if (!this.localStream) this.localStream = markRaw(new MediaStream());

		const constraints = {
			[MediaType.Audio]: { audio: true },
			[MediaType.Video]: { video: true },
			[MediaType.Screen]: null,
		};

		let track: MediaStreamTrack;
		if (type === MediaType.Screen) {
			const stream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true });
			track = stream.getVideoTracks()[0];
		} else {
			const stream = await navigator.mediaDevices.getUserMedia(constraints[type] as any);
			track = type === MediaType.Audio ? stream.getAudioTracks()[0] : stream.getVideoTracks()[0];
		}

		this.localTrackIds.set(type, track.id);
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

		if (track) {
			track.stop();
			this.localStream?.removeTrack(track);
			this.localTrackIds.delete(type);
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
		this.localStream = undefined;
		this.localTrackIds.clear();
		this.pcs.forEach((_, id) => this.removePeerConnection(id));
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
