<script setup lang="ts">
	import { computed, reactive } from 'vue';
	import { useMeStore } from '@/stores/me';
	import { useVoiceStore } from '@/stores/voice';
	import { MediaType, webrtcService } from '@/services/webrtc';
	import { Icon } from '@iconify/vue';
	import type { Channel, id } from '@/types';
	import { useRouter } from 'vue-router';
	import { getDefaultAvatar } from '@/utils/avatar';
	import { useWatchStore } from '@/stores/watch';
	import { useAppStore } from '@/stores/app';

	const props = defineProps<{
		channel: Channel;
	}>();

	const meStore = useMeStore();
	const watchStore = useWatchStore();
	const appStore = useAppStore();
	const voiceStore = useVoiceStore();
	const router = useRouter();

	const me = $computed(() => meStore.me!);

	const getTrack = (userId: id, type: MediaType) => {
		return webrtcService.getTrack(userId, type);
	};

	const isTrackActive = (userId: id, type: MediaType) => {
		const track = getTrack(userId, type);
		if (!track) return false;
		return track.readyState === 'live' && track.enabled && webrtcService.activeTracks.has(track.id);
	};

	const loadedVideos = reactive(new Set<string>());

	const onVideoLoaded = (userId: id, type: MediaType) => {
		const track = getTrack(userId, type);
		if (track) {
			loadedVideos.add(track.id);
		}
	};

	const isVideoVisible = (userId: id, type: MediaType) => {
		if (!isTrackActive(userId, type)) return false;
		const track = getTrack(userId, type);
		return track ? loadedVideos.has(track.id) : false;
	};

	const streamCache = new Map<string, MediaStream>();

	const Stream = (track: MediaStreamTrack | undefined) => {
		if (!track) return null;
		if (!streamCache.has(track.id)) {
			streamCache.set(track.id, new MediaStream([track]));
		}
		return streamCache.get(track.id)!;
	};

	const leaveVoice = () => {
		router.back();
		voiceStore.leaveVoice();
	};

	const toggleFullScreen = (event: Event) => {
		const videoEl = (event.currentTarget as HTMLElement).closest('.user-card')?.querySelector('video');
		if (videoEl) {
			if (!document.fullscreenElement) {
				videoEl.requestFullscreen().catch((err) => {
					console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
				});
			} else {
				document.exitFullscreen();
			}
		}
	};
</script>

<template>
	<div class="voice-container">
		<div class="participants-area">
			<div class="participants">
				<!-- Local Screen Share -->
				<div
					v-if="voiceStore.isScreenSharing && me"
					class="user-card screen-share-card"
					:class="{ 'is-speaking': webrtcService.speakingUsers.has(me.id) }"
				>
					<video :srcObject="Stream(getTrack(me.id, MediaType.Screen))" autoplay muted class="video-element" />
					<div class="card-overlay">
						<Icon icon="ic:round-screen-share" />
						<span>Your screen</span>
					</div>
					<button class="fullscreen-btn" @click="toggleFullScreen" title="Full screen">
						<Icon icon="mdi:fullscreen" />
					</button>
				</div>

				<!-- Remote Screen Shares -->
				<template v-for="user in props.channel.users" :key="'screen-' + user.id">
					<div
						v-show="me && user.id !== me.id && isVideoVisible(user.id, MediaType.Screen)"
						class="user-card screen-share-card"
						:class="{ 'is-speaking': webrtcService.speakingUsers.has(user.id) }"
					>
						<video
							:srcObject="Stream(getTrack(user.id, MediaType.Screen))"
							autoplay
							playsinline
							class="video-element"
							@loadeddata="onVideoLoaded(user.id, MediaType.Screen)"
						/>
						<div class="card-overlay">
							<Icon icon="ic:round-screen-share" />
							<span>{{ user.name }}'s screen</span>
						</div>
						<button class="fullscreen-btn" @click="toggleFullScreen" title="Full screen">
							<Icon icon="mdi:fullscreen" />
						</button>
					</div>
				</template>

				<!-- Local User -->
				<div
					class="user-card normal-card"
					v-if="me && Array.from(props.channel.users || []).some((u) => u.id === me.id)"
					:class="{ 'is-speaking': webrtcService.speakingUsers.has(me.id) }"
				>
					<video
						v-if="voiceStore.isVideoOn"
						:srcObject="Stream(getTrack(me.id, MediaType.Video))"
						autoplay
						muted
						class="video-element"
					/>
					<div v-else class="avatar-wrapper">
						<img :src="me.avatar || getDefaultAvatar(me.username)" alt="" class="avatar-circle" />
					</div>

					<div class="card-overlay">
						<span>{{ me.name }} (You)</span>
						<div v-if="voiceStore.isMuted" class="status-icons">
							<Icon icon="mdi:microphone-off" class="status-icon text-red" />
						</div>
					</div>
					<button v-if="voiceStore.isVideoOn" class="fullscreen-btn" @click="toggleFullScreen" title="Full screen">
						<Icon icon="mdi:fullscreen" />
					</button>
				</div>

				<!-- Remote Users -->
				<template v-for="user in props.channel.users" :key="user.id">
					<div
						v-if="me && user.id !== me.id"
						class="user-card normal-card"
						:class="{ 'is-speaking': webrtcService.speakingUsers.has(user.id) }"
					>
						<video
							v-show="isVideoVisible(user.id, MediaType.Video)"
							:srcObject="Stream(getTrack(user.id, MediaType.Video))"
							autoplay
							playsinline
							class="video-element"
							@loadeddata="onVideoLoaded(user.id, MediaType.Video)"
						/>
						<div v-show="!isVideoVisible(user.id, MediaType.Video)" class="avatar-wrapper">
							<img :src="user.avatar || getDefaultAvatar(user.username)" alt="" class="avatar-circle" />
						</div>

						<div class="card-overlay">
							<span>{{ user.name }}</span>
							<div v-if="!isTrackActive(user.id, MediaType.Audio)" class="status-icons">
								<Icon icon="mdi:microphone-off" class="status-icon text-red" />
							</div>
						</div>
						<button
							v-show="isVideoVisible(user.id, MediaType.Video)"
							class="fullscreen-btn"
							@click="toggleFullScreen"
							title="Full screen"
						>
							<Icon icon="mdi:fullscreen" />
						</button>
					</div>
				</template>
			</div>
		</div>

		<!-- Control Bar -->
		<div v-if="voiceStore.voice_channel" class="voice-controls">
			<button
				v-if="appStore.isTauri"
				class="control-btn"
				@click="watchStore.createWatchParty(Number($route.params.serverId), props.channel.id)"
			>
				<Icon icon="streamline:film-slate-solid" />
			</button>
			<button class="control-btn" :class="{ 'is-active': voiceStore.isVideoOn }" @click="voiceStore.toggleVideo()">
				<Icon :icon="voiceStore.isVideoOn ? 'mdi:video' : 'mdi:video-off'" />
			</button>
			<button class="control-btn" :class="{ 'is-active': voiceStore.isScreenSharing }" @click="voiceStore.toggleScreen()">
				<Icon :icon="voiceStore.isScreenSharing ? 'mdi:monitor-share' : 'ic:round-stop-screen-share'" />
			</button>
			<button class="control-btn" :class="{ 'is-danger-active': voiceStore.isMuted }" @click="voiceStore.toggleMute()">
				<Icon :icon="voiceStore.isMuted ? 'mdi:microphone-off' : 'mdi:microphone'" />
			</button>
			<button class="control-btn danger-btn disconnect-btn" @click="leaveVoice">
				<Icon icon="mdi:phone-hangup" />
			</button>
		</div>
	</div>
</template>

<style scoped>
	.voice-container {
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%;
		background-color: var(--bg-darkest);
		position: relative;
		flex: 1;
	}

	.participants-area {
		flex: 1;
		display: flex;
		padding: 24px;
		justify-content: center;
		align-items: center;
		overflow-y: auto;
		height: 0;
	}

	.participants {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
		width: 100%;
		max-width: 1600px;
		height: 100%;
		align-items: center;
		justify-content: center;
		align-content: center;
	}

	.user-card {
		position: relative;
		background-color: var(--bg-dark);
		border-radius: 12px;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 0 0 100%;
		max-width: 500px;
		aspect-ratio: 16 / 9;
		box-shadow: 0 8px 16px rgba(0, 0, 0, 0.4);
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
		width: 100%;
		aspect-ratio: auto;
		height: auto;
		max-height: 75vh;
		background-color: var(--bg-darkest);
	}

	@media (min-width: 1024px) {
		.screen-share-card {
			flex: 2 1 60%;
		}
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
		width: 90px;
		height: 90px;
		border-radius: 50%;
		background-color: var(--color);
		color: var(--text);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 2.2rem;
		font-weight: 600;
		box-shadow: 0 4px 10px rgba(0, 0, 0, 0.5);
	}

	.card-overlay {
		position: absolute;
		bottom: 12px;
		left: 12px;
		background-color: var(--overlay);
		padding: 4px 8px;
		border-radius: 8px;
		color: var(--text);
		font-size: 0.9rem;
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
		background-color: var(--bg-darkest);
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 16px;
		padding: 0 24px;
		border-top: 1px solid var(--border-muted);
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

	.fullscreen-btn {
		position: absolute;
		top: 12px;
		right: 12px;
		background: rgba(0, 0, 0, 0.5);
		border: none;
		color: white;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		font-size: 20px;
		opacity: 0;
		transition:
			opacity 0.2s ease,
			background 0.2s ease;
	}

	.user-card:hover .fullscreen-btn {
		opacity: 1;
	}

	.fullscreen-btn:hover {
		background: rgba(0, 0, 0, 0.8);
	}
</style>
