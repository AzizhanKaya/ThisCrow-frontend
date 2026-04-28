<script setup lang="ts">
	import { computed, reactive } from 'vue';
	import { Icon } from '@iconify/vue';
	import { useMeStore } from '@/stores/me';
	import { useVoiceStore } from '@/stores/voice';
	import { useModalStore, ModalView } from '@/stores/modal';
	import { MediaType, webrtcService } from '@/services/webrtc';
	import { getDefaultAvatar } from '@/utils/avatar';
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

	const isTrackActive = (userId: number, type: MediaType) => {
		const track = getTrack(userId, type);
		if (!track) return false;
		return track.readyState === 'live' && track.enabled && webrtcService.activeTracks.has(track.id);
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
		await voiceStore.joinVoice(undefined, undefined, props.targetUser);
	}
</script>

<template>
	<div class="direct-voice-header">
		<div class="participants-area">
			<div class="participants">
				<!-- Local Screen Share -->
				<div
					v-if="voiceStore.isScreenSharing && meStore.me"
					class="user-card screen-share-card"
					:class="{ 'is-speaking': webrtcService.speakingUsers.has(meStore.me.id) }"
				>
					<video :srcObject="Stream(getTrack(meStore.me.id, MediaType.Screen))" autoplay muted class="video-element" />
					<div class="card-overlay">
						<Icon icon="ic:round-screen-share" />
						<span>Your screen</span>
					</div>
				</div>

				<!-- Remote Screen Share -->
				<div
					v-show="targetUser && isVideoVisible(targetUser.id, MediaType.Screen)"
					class="user-card screen-share-card"
					:class="{ 'is-speaking': webrtcService.speakingUsers.has(targetUser.id) }"
				>
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
				<div
					v-if="isCalling"
					:class="[
						voiceStore.isVideoOn ? 'user-card normal-card' : 'voice-avatar-container',
						{ 'is-speaking': voiceStore.isVideoOn && webrtcService.speakingUsers.has(meStore.me!.id) },
					]"
				>
					<template v-if="voiceStore.isVideoOn">
						<video
							v-if="meStore.me"
							:srcObject="Stream(getTrack(meStore.me.id, MediaType.Video))"
							autoplay
							muted
							class="video-element"
						/>
						<div class="card-overlay">
							<span>{{ meStore.me?.name }} (You)</span>
							<div v-if="voiceStore.isMuted" class="status-icons">
								<Icon icon="mdi:microphone-off" class="status-icon text-red" />
							</div>
						</div>
					</template>
					<template v-else>
						<div class="voice-avatar" :class="{ 'is-speaking': webrtcService.speakingUsers.has(meStore.me!.id) }">
							<img :src="meStore.me?.avatar || getDefaultAvatar(meStore.me?.username)" alt="" class="avatar-circle" />

							<div v-if="voiceStore.isMuted" class="avatar-mute-badge">
								<Icon icon="mdi:microphone-off" />
							</div>
						</div>
					</template>
				</div>

				<!-- Remote User -->
				<div v-if="isRinging">
					<!-- Video Card -->
					<div
						v-show="isVideoVisible(targetUser.id, MediaType.Video)"
						class="user-card normal-card"
						:class="{ 'is-speaking': webrtcService.speakingUsers.has(targetUser.id) }"
					>
						<video
							v-show="isVideoVisible(targetUser.id, MediaType.Video)"
							:srcObject="Stream(getTrack(targetUser.id, MediaType.Video))"
							autoplay
							playsinline
							class="video-element"
							@loadeddata="onVideoLoaded(targetUser.id, MediaType.Video)"
						/>
						<!-- Removed username overlay for remote user -->
					</div>

					<!-- Voice Avatar Fallback -->
					<div v-show="!isVideoVisible(targetUser.id, MediaType.Video)" class="voice-avatar-container">
						<div class="voice-avatar" :class="{ 'is-speaking': webrtcService.speakingUsers.has(targetUser.id) }">
							<img :src="targetUser.avatar || getDefaultAvatar(targetUser.username)" alt="" class="avatar-circle" />
						</div>
						<!-- Removed username label for remote user -->
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
			<button v-if="isCalling" class="control-btn danger-btn disconnect-btn" @click="voiceStore.leaveVoice()">
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
		flex: 1 1 300px;
		max-width: 450px;
		aspect-ratio: 16 / 9;
		box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4);
		border: 2px solid rgba(255, 255, 255, 0.05);
		transition:
			transform 0.2s ease,
			border-color 0.2s ease,
			box-shadow 0.2s ease;
	}

	.user-card.is-speaking {
		box-shadow:
			0 0 16px var(--success),
			0 8px 16px rgba(0, 0, 0, 0.4);
		border-color: var(--success);
	}

	.user-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 12px 20px rgba(0, 0, 0, 0.5);
	}

	.user-card.is-speaking:hover {
		box-shadow:
			0 0 24px var(--success),
			0 12px 20px rgba(0, 0, 0, 0.5);
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

	.voice-avatar-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 24px;
		margin: 0 10px;
		max-width: 300px;
	}

	.voice-avatar {
		width: 120px;
		height: 120px;
		border-radius: 50%;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 3px solid transparent;
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease;
	}

	.avatar-circle {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		color: var(--text);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 3rem;
		font-weight: 600;
		box-shadow: 0 4px 10px rgba(0, 0, 0, 0.5);
		object-fit: cover;
	}

	.voice-avatar.is-speaking {
		box-shadow:
			0 0 16px var(--success),
			0 8px 16px rgba(0, 0, 0, 0.2);
		border-color: var(--success);
	}

	.avatar-label {
		color: var(--text);
		font-weight: 500;
		font-size: 1.2rem;
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
		white-space: nowrap;
	}

	.avatar-mute-badge {
		position: absolute;
		bottom: 0;
		right: 0;
		background-color: var(--bg-dark);
		color: var(--error);
		width: 40px;
		height: 40px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.5rem;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
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
