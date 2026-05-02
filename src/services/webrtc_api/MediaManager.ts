import { markRaw, reactive } from 'vue';
import type { id } from '@/types';
import { useMeStore } from '@/stores/me';
import { useVoiceStore } from '@/stores/voice';
import { MediaType, MEDIA_INDEX, type PeerConnection } from './types';
import type { PeerManager } from './PeerManager';

export class MediaManager {
	localStream?: MediaStream;
	private localTrackIds = new Map<MediaType, string>();
	private hardwareTracks = new Map<MediaType, MediaStreamTrack>();
	public activeTracks = reactive(new Set<string>());

	constructor(private peerManager: PeerManager) {}

	private get me() {
		return useMeStore().me;
	}

	setupTrackListeners(track: MediaStreamTrack) {
		if ((track as any)._hasMuteListener) return;
		(track as any)._hasMuteListener = true;

		if (!track.muted) this.activeTracks.add(track.id);

		track.addEventListener('mute', () => this.activeTracks.delete(track.id));
		track.addEventListener('unmute', () => this.activeTracks.add(track.id));
		track.addEventListener('ended', () => this.activeTracks.delete(track.id));
	}

	async addTrack(
		type: MediaType,
		deviceId?: string,
		audioProcessFn?: (stream: MediaStream) => Promise<{ processedTrack: MediaStreamTrack; hardwareTrack: MediaStreamTrack }>,
	): Promise<MediaStreamTrack> {
		if (!this.localStream) this.localStream = markRaw(new MediaStream());

		let track: MediaStreamTrack;
		let hardwareTrack: MediaStreamTrack;

		if (type === MediaType.Screen) {
			const stream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true });
			track = stream.getVideoTracks()[0];
			hardwareTrack = track;
		} else if (type === MediaType.Audio && audioProcessFn) {
			const constraints = this.buildAudioConstraints(deviceId);
			const stream = await navigator.mediaDevices.getUserMedia({ audio: constraints });
			const result = await audioProcessFn(stream);
			track = result.processedTrack;
			hardwareTrack = result.hardwareTrack;
		} else if (type === MediaType.Video) {
			const stream = await navigator.mediaDevices.getUserMedia({ video: true });
			hardwareTrack = stream.getVideoTracks()[0];
			track = hardwareTrack;
		} else {
			// Audio without processing (fallback)
			const constraints = this.buildAudioConstraints(deviceId);
			const stream = await navigator.mediaDevices.getUserMedia({ audio: constraints });
			hardwareTrack = stream.getAudioTracks()[0];
			track = hardwareTrack;
		}

		this.localTrackIds.set(type, track.id);
		this.hardwareTracks.set(type, hardwareTrack);
		this.localStream.addTrack(track);
		this.setupTrackListeners(track);

		this.peerManager.injectTrack(track, MEDIA_INDEX[type]);

		return track;
	}

	async removeTrack(type: MediaType) {
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

		this.peerManager.injectTrack(null, MEDIA_INDEX[type]);
	}

	getTrack(userId: id, type: MediaType): MediaStreamTrack | undefined {
		if (this.me && userId === this.me.id) {
			const trackId = this.localTrackIds.get(type);
			return this.localStream?.getTracks().find((t) => t.id === trackId);
		}
		return this.peerManager.getTransceiverTrack(userId, MEDIA_INDEX[type]);
	}

	/** Injects all current local tracks into a peer (used when a new peer is created from incoming offer) */
	injectAllInto(peer: PeerConnection) {
		if (!this.localStream) return;
		const tracks = this.localStream.getTracks();
		const transceivers = peer.connection.getTransceivers();

		for (const [type, trackId] of this.localTrackIds) {
			const track = tracks.find((t) => t.id === trackId);
			const idx = MEDIA_INDEX[type];
			if (track && transceivers[idx]) {
				transceivers[idx].sender.replaceTrack(track);
			}
		}
	}

	private buildAudioConstraints(deviceId?: string): MediaTrackConstraints {
		const voiceStore = useVoiceStore();
		const c: MediaTrackConstraints = deviceId ? { deviceId } : {};
		c.echoCancellation = true;
		if (voiceStore.noiseSuppression) {
			c.noiseSuppression = true;
			c.autoGainControl = true;
		} else {
			c.noiseSuppression = false;
			c.autoGainControl = false;
		}
		return c;
	}

	destroyAll() {
		this.localStream?.getTracks().forEach((t) => t.stop());
		this.hardwareTracks.forEach((t) => t.stop());
		this.localStream = undefined;
		this.localTrackIds.clear();
		this.hardwareTracks.clear();
		this.activeTracks.clear();
	}
}
