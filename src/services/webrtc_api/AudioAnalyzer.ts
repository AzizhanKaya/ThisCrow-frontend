import { reactive, ref } from 'vue';
import type { id } from '@/types';

export class AudioAnalyzer {
	public speakingUsers = reactive(new Set<id>());
	public inputLevel = ref(0);

	private audioContext?: AudioContext;
	private localProcessorInterval?: number;
	private remoteMonitors = new Map<string, number>();

	constructor(private meGetter: () => id | undefined) {}

	private ensureAudioContext(): AudioContext {
		if (!this.audioContext) {
			this.audioContext = new AudioContext();
		} else if (this.audioContext.state === 'suspended') {
			this.audioContext.resume();
		}
		return this.audioContext;
	}

	async processLocalAudio(
		stream: MediaStream,
		getThreshold: () => number,
	): Promise<{ processedTrack: MediaStreamTrack; hardwareTrack: MediaStreamTrack }> {
		const ctx = this.ensureAudioContext();
		if (ctx.state === 'suspended') await ctx.resume();

		const hardwareTrack = stream.getAudioTracks()[0];
		const source = ctx.createMediaStreamSource(stream);
		const analyser = ctx.createAnalyser();
		const gainNode = ctx.createGain();
		const destination = ctx.createMediaStreamDestination();

		source.connect(analyser);
		source.connect(gainNode);
		gainNode.connect(destination);

		analyser.fftSize = 512;
		const bufferLength = analyser.fftSize;
		const dataArray = new Float32Array(bufferLength);

		let holdFrames = 0;
		const HOLD_DURATION = 10;

		if (this.localProcessorInterval) {
			clearInterval(this.localProcessorInterval);
		}

		const checkVolume = () => {
			if (!this.audioContext || this.audioContext.state === 'closed') return;
			analyser.getFloatTimeDomainData(dataArray);

			let sum = 0;
			for (let i = 0; i < bufferLength; i++) {
				sum += dataArray[i] * dataArray[i];
			}
			const rms = Math.sqrt(sum / bufferLength);
			this.inputLevel.value = Math.min(1, rms / 0.15);

			const threshold = getThreshold();
			const meId = this.meGetter();

			if (rms > threshold) {
				gainNode.gain.setTargetAtTime(1, this.audioContext.currentTime, 0.05);
				holdFrames = HOLD_DURATION;
				if (meId) this.speakingUsers.add(meId);
			} else {
				if (holdFrames > 0) {
					holdFrames--;
					if (meId) this.speakingUsers.add(meId);
				} else {
					gainNode.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.1);
					if (meId) this.speakingUsers.delete(meId);
				}
			}
		};

		this.localProcessorInterval = window.setInterval(checkVolume, 50);
		checkVolume();

		const processedTrack = destination.stream.getAudioTracks()[0];

		hardwareTrack.addEventListener('ended', () => {
			processedTrack.stop();
			processedTrack.dispatchEvent(new Event('ended'));
		});

		return { processedTrack, hardwareTrack };
	}

	monitorRemoteAudio(userId: id, track: MediaStreamTrack, connection: RTCPeerConnection) {
		const ctx = this.ensureAudioContext();

		const stream = new MediaStream([track]);
		const source = ctx.createMediaStreamSource(stream);
		const analyser = ctx.createAnalyser();
		source.connect(analyser);

		analyser.fftSize = 256;
		const bufferLength = analyser.fftSize;
		const dataArray = new Float32Array(bufferLength);

		let holdFrames = 0;
		const HOLD_DURATION = 5;
		const key = `${userId}-${track.id}`;

		const intervalId = window.setInterval(() => {
			if (track.readyState === 'ended' || connection.connectionState === 'closed') {
				this.speakingUsers.delete(userId);
				clearInterval(intervalId);
				this.remoteMonitors.delete(key);
				return;
			}

			if (this.audioContext?.state === 'suspended') this.audioContext.resume();

			analyser.getFloatTimeDomainData(dataArray);
			let sum = 0;
			for (let i = 0; i < bufferLength; i++) {
				sum += dataArray[i] * dataArray[i];
			}
			const rms = Math.sqrt(sum / bufferLength);

			if (rms > 0.005) {
				this.speakingUsers.add(userId);
				holdFrames = HOLD_DURATION;
			} else if (holdFrames > 0) {
				holdFrames--;
			} else {
				this.speakingUsers.delete(userId);
			}
		}, 100);

		this.remoteMonitors.set(key, intervalId);
	}

	stopLocalProcessor() {
		if (this.localProcessorInterval) {
			clearInterval(this.localProcessorInterval);
			this.localProcessorInterval = undefined;
		}
		const meId = this.meGetter();
		if (meId) this.speakingUsers.delete(meId);
		this.inputLevel.value = 0;
	}

	destroyAll() {
		this.stopLocalProcessor();
		for (const intervalId of this.remoteMonitors.values()) {
			clearInterval(intervalId);
		}
		this.remoteMonitors.clear();
		this.speakingUsers.clear();
	}
}
