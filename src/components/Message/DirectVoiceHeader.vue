<script setup lang="ts">
	import { computed, reactive } from 'vue';
	import { Icon } from '@iconify/vue';
	import { useMeStore } from '@/stores/me';
	import { useVoiceStore } from '@/stores/voice';
	import { useModalStore, ModalView } from '@/stores/modal';
	import { MediaType, webrtcService } from '@/services/webrtc';
	import type { User } from '@/types';

	const props = defineProps<{
		targetUser: User;
	}>();

	const meStore = useMeStore();
	const voiceStore = useVoiceStore();
	const modalStore = useModalStore();

	const isRinging = computed(() => {
		return voiceStore.on_voice_direct.includes(props.targetUser.id);
	});

	const isCalling = computed(() => {
		return voiceStore.voice_direct?.id === props.targetUser.id;
	});

	const getTrack = (userId: number, type: MediaType) => {
		return webrtcService.getTrack(userId, type);
	};

	const trackStates = reactive(new Map<string, boolean>());

	const isTrackActive = (userId: number, type: MediaType) => {
		const track = getTrack(userId, type);
		if (!track) return false;

		const trackId = track.id;

		if (!(track as any)._hasListener) {
			(track as any)._hasListener = true;

			const updateState = (e?: globalThis.Event) => {
				const active = !track.muted && track.readyState === 'live' && track.enabled;
				trackStates.set(trackId, active);
			};

			track.addEventListener('mute', updateState);
			track.addEventListener('unmute', updateState);
			track.addEventListener('ended', updateState);

			updateState();
		}

		return trackStates.get(trackId) || false;
	};

	const activeVideos = reactive(new Set<string>());

	const onVideoLoaded = (userId: number, type: MediaType) => {
		const track = getTrack(userId, type);
		if (track) {
			activeVideos.add(track.id);
		}
	};

	const isVideoVisible = (userId: number, type: MediaType) => {
		if (!isTrackActive(userId, type)) return false;
		const track = getTrack(userId, type);
		return track ? activeVideos.has(track.id) : false;
	};

	const streamCache = new Map<string, MediaStream>();

	const Stream = (track: MediaStreamTrack | undefined) => {
		if (!track) return null;
		if (!streamCache.has(track.id)) {
			streamCache.set(track.id, new MediaStream([track]));
		}
		return streamCache.get(track.id)!;
	};

	async function onCall() {
		if (isCalling.value) {
			await voiceStore.leaveVoice();
		} else {
			await voiceStore.joinVoice(undefined, undefined, props.targetUser);
		}
	}
</script>

<template>
	<div class="direct-voice-header">
		<div class="participants-area">
			<div class="participants">
				<!-- Local Screen Share -->
				<div v-if="voiceStore.isScreenSharing && meStore.me" class="user-card screen-share-card">
					<video :srcObject="Stream(getTrack(meStore.me.id, MediaType.Screen))" autoplay muted class="video-element" />
					<div class="card-overlay">
						<Icon icon="ic:round-screen-share" />
						<span>Your screen</span>
					</div>
				</div>

				<!-- Remote Screen Share -->
				<div v-show="targetUser && isVideoVisible(targetUser.id, MediaType.Screen)" class="user-card screen-share-card">
					<video
						:srcObject="Stream(getTrack(targetUser.id, MediaType.Screen))"
						autoplay
						playsinline
						class="video-element"
						@loadeddata="onVideoLoaded(targetUser.id, MediaType.Screen)"
					/>
					<div class="card-overlay">
						<Icon icon="ic:round-screen-share" />
						<span>{{ targetUser?.name }}'s screen</span>
					</div>
				</div>

				<!-- Local User -->
				<div v-if="isCalling" class="user-card normal-card">
					<video
						v-if="voiceStore.isVideoOn && meStore.me"
						:srcObject="Stream(getTrack(meStore.me.id, MediaType.Video))"
						autoplay
						muted
						class="video-element"
					/>
					<div v-else-if="meStore.me?.avatar" class="avatar-wrapper">
						<img :src="meStore.me.avatar" alt="" class="avatar-circle" />
					</div>
					<div v-else class="avatar-wrapper">
						<div class="avatar-circle">{{ meStore.me?.name.charAt(0).toUpperCase() }}</div>
					</div>
					<div class="card-overlay">
						<span>{{ meStore.me?.name }} (You)</span>
						<div v-if="voiceStore.isMuted" class="status-icons">
							<Icon icon="mdi:microphone-off" class="status-icon text-red" />
						</div>
					</div>
				</div>

				<!-- Remote User -->
				<div v-if="isRinging" class="user-card normal-card">
					<video
						v-show="isVideoVisible(targetUser.id, MediaType.Video)"
						:srcObject="Stream(getTrack(targetUser.id, MediaType.Video))"
						autoplay
						playsinline
						class="video-element"
						@loadeddata="onVideoLoaded(targetUser.id, MediaType.Video)"
					/>
					<div v-show="!isVideoVisible(targetUser.id, MediaType.Video) && targetUser.avatar" class="avatar-wrapper">
						<img :src="targetUser.avatar" alt="" class="avatar-circle" />
					</div>
					<div v-show="!isVideoVisible(targetUser.id, MediaType.Video) && !targetUser.avatar" class="avatar-wrapper">
						<div class="avatar-circle">{{ targetUser.name.charAt(0).toUpperCase() }}</div>
					</div>
					<div class="card-overlay">
						<span>{{ targetUser.name }}</span>
					</div>
				</div>
			</div>
		</div>

		<div class="voice-controls">
			<button v-if="isCalling" class="control-btn" :class="{ 'is-active': voiceStore.isVideoOn }" @click="voiceStore.toggleVideo()">
				<Icon :icon="voiceStore.isVideoOn ? 'mdi:video' : 'mdi:video-off'" />
			</button>
			<button
				v-if="isCalling"
				class="control-btn"
				:class="{ 'is-active': voiceStore.isScreenSharing }"
				@click="voiceStore.toggleScreen()"
			>
				<Icon :icon="voiceStore.isScreenSharing ? 'mdi:monitor-share' : 'ic:round-stop-screen-share'" />
			</button>
			<button
				v-if="isCalling"
				class="control-btn"
				:class="{ 'is-danger-active': voiceStore.isMuted }"
				@click="voiceStore.toggleMute()"
			>
				<Icon :icon="voiceStore.isMuted ? 'mdi:microphone-off' : 'mdi:microphone'" />
			</button>
			<button v-if="isCalling" class="control-btn danger-btn disconnect-btn" @click="onCall">
				<Icon icon="mdi:phone-hangup" />
			</button>

			<button v-if="isRinging && !isCalling" class="control-btn success-btn disconnect-btn" @click="onCall">
				<Icon icon="ri:phone-fill" />
			</button>
		</div>
	</div>
</template>

<style scoped>
	.direct-voice-header {
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}

	.participants-area {
		width: 100%;
		display: flex;
		padding: 10px;
		justify-content: center;
		align-items: center;
	}

	.participants {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
		width: 100%;
		max-width: 1200px;
		align-items: center;
		justify-content: center;
	}

	.user-card {
		position: relative;
		background-color: var(--bg-dark);
		border-radius: 12px;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 1 1 200px;
		max-width: 300px;
		aspect-ratio: 16 / 9;
		box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4);
		border: 1px solid rgba(255, 255, 255, 0.05);
	}

	.screen-share-card {
		flex: 1 1 100%;
		max-width: 600px;
		aspect-ratio: auto;
		background-color: var(--bg-darkest);
	}

	.video-element {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.screen-share-card .video-element {
		object-fit: contain;
	}

	.avatar-wrapper {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: var(--bg-dark);
	}

	.avatar-circle {
		width: 80px;
		height: 80px;
		border-radius: 50%;
		background-color: var(--color, #555);
		color: var(--text);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 2rem;
		font-weight: 600;
		box-shadow: 0 4px 10px rgba(0, 0, 0, 0.5);
	}

	img.avatar-circle {
		object-fit: cover;
	}

	.card-overlay {
		position: absolute;
		bottom: 8px;
		left: 8px;
		background-color: var(--overlay);
		padding: 4px 8px;
		border-radius: 8px;
		color: var(--text);
		font-size: 0.8rem;
		font-weight: 500;
		display: flex;
		align-items: center;
		gap: 8px;
		backdrop-filter: blur(8px);
	}

	.status-icons {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.text-red {
		color: var(--error);
	}

	.calling-avatars {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 40px;
		width: 100%;
	}

	.calling-avatars img {
		width: 120px;
		height: 120px;
		border-radius: 50%;
		object-fit: cover;
		box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
	}

	.voice-controls {
		height: 80px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 16px;
		padding: 0 24px;
	}

	.control-btn {
		width: 52px;
		height: 52px;
		border-radius: 50%;
		background-color: var(--bg);
		color: var(--text-muted);
		border: none;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 24px;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.control-btn:hover {
		background-color: var(--bg-light);
		color: var(--text);
	}

	.control-btn.is-active,
	.control-btn.is-danger-active {
		background-color: var(--text);
		color: var(--bg-darkest);
	}

	.control-btn.is-danger-active {
		color: var(--error);
	}

	.control-btn.is-danger-active:hover {
		background-color: var(--text-muted);
	}

	.success-btn {
		background-color: var(--success);
		color: var(--text);
	}

	.success-btn:hover {
		background-color: var(--success-hover);
	}

	.danger-btn {
		background-color: var(--error);
		color: var(--text);
	}

	.danger-btn:hover {
		background-color: var(--error-hover);
		color: var(--text);
	}

	.disconnect-btn {
		width: 64px;
		border-radius: 24px;
	}
</style>
