<script setup lang="ts">
	import { computed, ref } from 'vue';
	import { useMeStore } from '@/stores/me';
	import { useVoiceStore } from '@/stores/voice';
	import { MediaType, webrtcService } from '@/services/webrtc';
	import { Icon } from '@iconify/vue';
	import type { Channel, id } from '@/types';
	import { storeToRefs } from 'pinia';

	const props = defineProps<{
		channel: Channel;
	}>();

	const meStore = useMeStore();
	const me = $computed(() => meStore.me!);

	const voiceStore = useVoiceStore();

	const isMuted = ref(false);
	const isVideoOn = ref(false);
	const isScreenSharing = ref(false);

	const getTrack = (userId: id, type: MediaType) => {
		return webrtcService.getTrack(userId, type);
	};

	const Stream = (track: MediaStreamTrack | undefined) => {
		if (!track) return null;
		return new MediaStream([track]);
	};

	const toggleMute = () => {
		isMuted.value = !isMuted.value;
		webrtcService.toggleTrack(MediaType.Audio, !isMuted.value);
	};

	const toggleVideo = async () => {
		try {
			const existingTrack = getTrack(me.id, MediaType.Video);
			if (!existingTrack) {
				await webrtcService.addTrack(MediaType.Video);
				isVideoOn.value = true;

				const track = getTrack(me.id, MediaType.Video);
				if (track) {
					track.onended = () => {
						isVideoOn.value = false;
						webrtcService.toggleTrack(MediaType.Video, false);
					};
				}
			} else {
				isVideoOn.value = !isVideoOn.value;
				webrtcService.toggleTrack(MediaType.Video, isVideoOn.value);
			}
		} catch (error) {
			console.error('Kamera açılamadı:', error);
		}
	};

	const toggleScreen = async () => {
		try {
			const existingTrack = getTrack(me.id, MediaType.Screen);
			if (!existingTrack) {
				await webrtcService.addTrack(MediaType.Screen);
				isScreenSharing.value = true;

				const track = getTrack(me.id, MediaType.Screen);
				if (track) {
					track.onended = () => {
						isScreenSharing.value = false;
						webrtcService.toggleTrack(MediaType.Screen, false);
					};
				}
			} else {
				isScreenSharing.value = !isScreenSharing.value;
				webrtcService.toggleTrack(MediaType.Screen, isScreenSharing.value);
			}
		} catch (error) {
			console.error('Ekran paylaşılamadı:', error);
		}
	};

	const leaveVoice = () => {
		voiceStore.leaveVoice();
	};
</script>

<template>
	<div class="voice-container">
		<div class="participants-area">
			<div class="participants-grid">
				<!-- Local Screen Share -->
				<div v-if="getTrack(me.id, MediaType.Screen) && isScreenSharing" class="user-card screen-share-card">
					<video :srcObject="Stream(getTrack(me.id, MediaType.Screen))" autoplay muted class="video-element" />
					<div class="card-overlay">
						<Icon icon="ic:round-screen-share" />
						<span>Ekranınız</span>
					</div>
				</div>

				<!-- Remote Screen Shares -->
				<template v-for="user in props.channel.users" :key="'screen-' + user.id">
					<div v-if="user.id !== me.id && getTrack(user.id, MediaType.Screen)" class="user-card screen-share-card">
						<video :srcObject="Stream(getTrack(user.id, MediaType.Screen))" autoplay playsinline class="video-element" />
						<div class="card-overlay">
							<Icon icon="ic:round-screen-share" />
							<span>{{ user.name }} - Ekran</span>
						</div>
					</div>
				</template>

				<!-- Local User -->
				<div class="user-card normal-card" v-if="props.channel.users?.has(me)">
					<video
						v-if="getTrack(me.id, MediaType.Video) && isVideoOn"
						:srcObject="Stream(getTrack(me.id, MediaType.Video))"
						autoplay
						muted
						class="video-element"
					/>
					<div v-else class="avatar-wrapper">
						<div class="avatar-circle">{{ me.name.charAt(0).toUpperCase() }}</div>
					</div>
					<div class="card-overlay">
						<span>{{ me.name }} (Siz)</span>
						<div class="status-icons">
							<Icon v-if="isMuted" icon="mdi:microphone-off" class="status-icon text-red" />
						</div>
					</div>
				</div>

				<!-- Remote Users -->
				<template v-for="user in props.channel.users" :key="user.id">
					<div v-if="user.id !== me.id" class="user-card normal-card">
						<video
							v-if="getTrack(user.id, MediaType.Video)"
							:srcObject="Stream(getTrack(user.id, MediaType.Video))"
							autoplay
							playsinline
							class="video-element"
						/>
						<div v-else class="avatar-wrapper">
							<div class="avatar-circle">{{ user.name.charAt(0).toUpperCase() }}</div>
						</div>
						<div class="card-overlay">
							<span>{{ user.name }}</span>
						</div>
					</div>
				</template>
			</div>
		</div>

		<!-- Control Bar -->
		<div class="voice-controls">
			<button class="control-btn" :class="{ 'is-active': isVideoOn }" @click="toggleVideo">
				<Icon :icon="isVideoOn ? 'mdi:video' : 'mdi:video-off'" />
			</button>
			<button class="control-btn" :class="{ 'is-active': isScreenSharing }" @click="toggleScreen">
				<Icon :icon="isScreenSharing ? 'mdi:monitor-share' : 'ic:round-stop-screen-share'" />
			</button>
			<button class="control-btn" :class="{ 'is-danger-active': isMuted }" @click="toggleMute">
				<Icon :icon="isMuted ? 'mdi:microphone-off' : 'mdi:microphone'" />
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

	.participants-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
		grid-auto-rows: minmax(220px, auto);
		gap: 16px;
		width: 100%;
		max-width: 1600px;
		height: 100%;
		align-items: center;
		justify-items: center;
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
		width: 100%;
		aspect-ratio: 16 / 9;
		max-height: 450px;
		box-shadow: 0 8px 16px rgba(0, 0, 0, 0.4);
		border: 1px solid rgba(255, 255, 255, 0.05);
		transition:
			transform 0.2s ease,
			box-shadow 0.2s ease;
	}

	.user-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 12px 20px rgba(0, 0, 0, 0.5);
	}

	.screen-share-card {
		grid-column: 1 / -1;
		aspect-ratio: auto;
		height: 100%;
		max-height: 75vh;
		background-color: var(--bg-darkest);
	}

	@media (min-width: 1024px) {
		.screen-share-card {
			grid-column: span 2;
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
		padding: 6px 12px;
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
</style>
