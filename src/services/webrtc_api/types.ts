import type { id } from '@/types';

export enum MediaType {
	Audio = 'audio',
	Video = 'video',
	Screen = 'screen',
}

export const MEDIA_INDEX: Record<MediaType, number> = {
	[MediaType.Audio]: 0,
	[MediaType.Video]: 1,
	[MediaType.Screen]: 2,
};

export enum PeerState {
	New = 'new',
	Connecting = 'connecting',
	Connected = 'connected',
	Disconnected = 'disconnected',
	Failed = 'failed',
	Closed = 'closed',
}

export interface PeerConnection {
	connection: RTCPeerConnection;
	remoteStream: MediaStream;
	userId: id;
	state: PeerState;
	makingOffer: boolean;
	ignoreOffer: boolean;
	isSettingRemoteAnswerPending: boolean;
}

export interface WebRTCConfig {
	iceServers: RTCIceServer[];
	connectionTimeoutMs: number;
	iceRestartDelayMs: number;
	maxIceRestarts: number;
	pendingBufferTtlMs: number;
	latencyPollIntervalMs: number;
}

export const DEFAULT_CONFIG: WebRTCConfig = {
	iceServers: [
		{ urls: 'stun:stun.l.google.com:19302' },
		{ urls: 'stun:stun1.l.google.com:19302' },
	],
	connectionTimeoutMs: 15_000,
	iceRestartDelayMs: 3_000,
	maxIceRestarts: 3,
	pendingBufferTtlMs: 30_000,
	latencyPollIntervalMs: 2_000,
};
