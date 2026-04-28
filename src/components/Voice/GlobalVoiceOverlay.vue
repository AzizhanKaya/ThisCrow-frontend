<script setup lang="ts">
	import { webrtcService, MediaType } from '@/services/webrtc';
	import { computed, ref, reactive, onMounted, onUnmounted, watch } from 'vue';
	import { useRoute, useRouter } from 'vue-router';
	import { useVoiceStore } from '@/stores/voice';
	import { Icon } from '@iconify/vue';
	import { useMeStore } from '@/stores/me';
	import type { id } from '@/types';

	const route = useRoute();
	const router = useRouter();
	const voiceStore = useVoiceStore();
	const meStore = useMeStore();

	const peers = computed(() => {
		const _ = webrtcService.stateUpdate.value;
		return Array.from(webrtcService.pcs.values());
	});

	const isVoiceViewActive = computed(() => {
		const isServerVoice =
			route.name === 'server' &&
			Number(route.params.serverId) === voiceStore.group_id &&
			Number(route.params.channelId) === voiceStore.voice_channel?.id;

		const isDirectVoice = route.name === 'user' && Number(route.params.userId) === voiceStore.voice_direct?.id;

		return isServerVoice || isDirectVoice;
	});

	const loadedVideos = reactive(new Set<string>());

	const onVideoLoaded = (trackId: string) => {
		loadedVideos.add(trackId);
	};

	const isVideoVisible = (trackId: string) => {
		return loadedVideos.has(trackId);
	};

	const activeVideoTracks = computed(() => {
		const _ = webrtcService.stateUpdate.value;
		const tracks: { userId: id; track: MediaStreamTrack; type: MediaType; isLocal: boolean }[] = [];

		const me = meStore.me;
		if (me) {
			if (voiceStore.isVideoOn) {
				const track = webrtcService.getTrack(me.id, MediaType.Video);
				if (track) tracks.push({ userId: me.id, track, type: MediaType.Video, isLocal: true });
			}
			if (voiceStore.isScreenSharing) {
				const track = webrtcService.getTrack(me.id, MediaType.Screen);
				if (track) tracks.push({ userId: me.id, track, type: MediaType.Screen, isLocal: true });
			}
		}

		for (const peer of peers.value) {
			const videoTrack = webrtcService.getTrack(peer.userId as id, MediaType.Video);
			const screenTrack = webrtcService.getTrack(peer.userId as id, MediaType.Screen);

			if (videoTrack && webrtcService.activeTracks.has(videoTrack.id)) {
				tracks.push({ userId: peer.userId as id, track: videoTrack, type: MediaType.Video, isLocal: false });
			}
			if (screenTrack && webrtcService.activeTracks.has(screenTrack.id)) {
				tracks.push({ userId: peer.userId as id, track: screenTrack, type: MediaType.Screen, isLocal: false });
			}
		}

		return tracks;
	});

	const showPip = computed(() => {
		return !isVoiceViewActive.value && (voiceStore.voice_channel || voiceStore.voice_direct) && activeVideoTracks.value.length > 0;
	});

	interface PipState {
		corner: 'tr' | 'tl' | 'br' | 'bl';
		x: number;
		y: number;
		isDragging: boolean;
	}

	const pipStates = ref<Record<string, PipState>>({});

	const windowSize = ref({ w: window.innerWidth, h: window.innerHeight });
	const onResize = () => {
		windowSize.value = { w: window.innerWidth, h: window.innerHeight };
	};
	onMounted(() => window.addEventListener('resize', onResize));
	onUnmounted(() => window.removeEventListener('resize', onResize));

	watch(
		activeVideoTracks,
		(newTracks) => {
			const currentIds = new Set(newTracks.map((t) => t.userId + '-' + t.type));

			for (const id in pipStates.value) {
				if (!currentIds.has(id)) {
					delete pipStates.value[id];
				}
			}

			for (const track of newTracks) {
				const id = track.userId + '-' + track.type;
				if (!pipStates.value[id]) {
					pipStates.value[id] = {
						corner: 'br',
						x: 0,
						y: 0,
						isDragging: false,
					};
				}
			}
		},
		{ immediate: true }
	);

	const computedPositions = computed(() => {
		const corners: Record<string, string[]> = { tl: [], tr: [], bl: [], br: [] };

		for (const track of activeVideoTracks.value) {
			const id = track.userId + '-' + track.type;
			const state = pipStates.value[id];
			if (state && !state.isDragging) {
				corners[state.corner].push(id);
			}
		}

		const positions: Record<string, { x: number; y: number }> = {};
		const width = 320;
		const height = 180;
		const padding = 24;
		const gap = 12;
		const winW = windowSize.value.w;
		const winH = windowSize.value.h;

		for (const corner in corners) {
			const ids = corners[corner];
			for (let i = 0; i < ids.length; i++) {
				const id = ids[i];
				let x = 0;
				let y = 0;

				if (corner === 'tr' || corner === 'br') {
					x = winW - width - padding;
				} else {
					x = padding;
				}

				if (corner === 'br' || corner === 'bl') {
					y = winH - height - padding - i * (height + gap);
				} else {
					y = padding + i * (height + gap);
				}

				positions[id] = { x, y };
			}
		}

		for (const id in pipStates.value) {
			if (pipStates.value[id].isDragging) {
				positions[id] = { x: pipStates.value[id].x, y: pipStates.value[id].y };
			}
		}

		return positions;
	});

	let currentDragId: string | null = null;
	let startX = 0,
		startY = 0,
		initialX = 0,
		initialY = 0;

	const startDrag = (e: MouseEvent, id: string) => {
		if ((e.target as HTMLElement).closest('.pip-btn')) return;

		const state = pipStates.value[id];
		if (!state) return;

		currentDragId = id;

		if (computedPositions.value[id]) {
			state.x = computedPositions.value[id].x;
			state.y = computedPositions.value[id].y;
		}

		state.isDragging = true;
		startX = e.clientX;
		startY = e.clientY;

		initialX = state.x;
		initialY = state.y;

		document.addEventListener('mousemove', doDrag);
		document.addEventListener('mouseup', stopDrag);
	};

	const doDrag = (e: MouseEvent) => {
		if (!currentDragId) return;
		const state = pipStates.value[currentDragId];
		if (!state || !state.isDragging) return;

		state.x = initialX + (e.clientX - startX);
		state.y = initialY + (e.clientY - startY);
	};

	const stopDrag = () => {
		if (!currentDragId) return;
		const state = pipStates.value[currentDragId];
		if (state) {
			state.isDragging = false;

			const width = 320;
			const height = 180;
			const cx = state.x + width / 2;
			const cy = state.y + height / 2;

			const isLeft = cx < windowSize.value.w / 2;
			const isTop = cy < windowSize.value.h / 2;

			if (isTop && isLeft) state.corner = 'tl';
			else if (isTop && !isLeft) state.corner = 'tr';
			else if (!isTop && isLeft) state.corner = 'bl';
			else state.corner = 'br';
		}

		currentDragId = null;
		document.removeEventListener('mousemove', doDrag);
		document.removeEventListener('mouseup', stopDrag);
	};

	const streamCache = new Map<string, MediaStream>();
	const getStream = (track: MediaStreamTrack) => {
		if (!streamCache.has(track.id)) {
			streamCache.set(track.id, new MediaStream([track]));
		}
		return streamCache.get(track.id)!;
	};

	const returnToVoice = () => {
		if (voiceStore.voice_channel && voiceStore.group_id) {
			router.push(`/server/${voiceStore.group_id}/${voiceStore.voice_channel.id}`);
		} else if (voiceStore.voice_direct) {
			router.push(`/user/${voiceStore.voice_direct.id}`);
		}
	};

	const toggleFullScreen = (event: Event) => {
		const videoEl = (event.currentTarget as HTMLElement).closest('.pip-video-container')?.querySelector('video');
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

	const audioContainer = ref<HTMLElement | null>(null);

	const applyOutputDevice = () => {
		if (!audioContainer.value) return;
		const deviceId = voiceStore.selectedOutputDeviceId;
		if (!deviceId) return;
		const audioEls = audioContainer.value.querySelectorAll('audio');
		audioEls.forEach((el) => {
			if (typeof (el as any).setSinkId === 'function') {
				(el as any).setSinkId(deviceId).catch((e: Error) => {
					console.error('Failed to set output device:', e);
				});
			}
		});
	};

	watch(
		() => voiceStore.selectedOutputDeviceId,
		() => {
			setTimeout(applyOutputDevice, 50);
		}
	);

	watch(
		peers,
		() => {
			setTimeout(applyOutputDevice, 100);
		},
		{ deep: true }
	);
</script>

<template>
	<div class="global-voice-overlay">
		<div class="sr-only" ref="audioContainer">
			<audio
				v-for="peer in peers"
				:key="peer.userId + '-audio'"
				:srcObject="peer.remoteStream"
				autoplay
				playsinline
				:muted="voiceStore.isDeafened"
			></audio>
		</div>

		<div v-if="showPip" class="pip-container">
			<div
				v-for="(item, index) in activeVideoTracks"
				:key="item.userId + '-' + item.type"
				class="pip-video-container"
				v-show="isVideoVisible(item.track.id)"
				:class="{
					'is-dragging': pipStates[item.userId + '-' + item.type]?.isDragging,
					'is-transitioning': !pipStates[item.userId + '-' + item.type]?.isDragging,
					'is-speaking': webrtcService.speakingUsers.has(item.userId),
				}"
				:style="{
					left: (computedPositions[item.userId + '-' + item.type]?.x || 0) + 'px',
					top: (computedPositions[item.userId + '-' + item.type]?.y || 0) + 'px',
				}"
				@mousedown="startDrag($event, item.userId + '-' + item.type)"
			>
				<video
					@loadeddata="onVideoLoaded(item.track.id)"
					:srcObject="getStream(item.track)"
					autoplay
					playsinline
					:muted="item.isLocal"
					class="pip-video"
				></video>
				<div class="pip-controls">
					<button @click="returnToVoice" class="pip-btn pip-back-btn" title="Return to call">
						<Icon icon="mdi:arrow-left" />
					</button>
					<button @click="toggleFullScreen" class="pip-btn pip-fullscreen-btn" title="Full screen">
						<Icon icon="mdi:fullscreen" />
					</button>
				</div>
			</div>
		</div>
	</div>
</template>

<style scoped>
	.pip-container {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		z-index: 9999;
		pointer-events: none;
	}

	.pip-video-container {
		position: absolute;
		width: 320px;
		aspect-ratio: 16 / 9;
		background-color: var(--bg-darkest);
		border-radius: 12px;
		overflow: hidden;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
		border: 2px solid var(--border);
		pointer-events: auto;
		cursor: grab;
	}

	.pip-video-container.is-speaking {
		box-shadow:
			0 0 16px var(--success),
			0 8px 24px rgba(0, 0, 0, 0.8);
		border-color: var(--success);
	}

	.pip-video-container.is-speaking:hover {
		box-shadow:
			0 0 24px var(--success),
			0 8px 24px rgba(0, 0, 0, 0.8);
	}

	.pip-video-container.is-transitioning {
		transition:
			top 0.2s ease,
			left 0.2s ease,
			transform 0.2s ease;
	}

	.pip-video-container.is-dragging {
		cursor: grabbing;
		z-index: 10000;
	}

	.pip-video-container:hover {
		transform: scale(1.02);
	}

	.pip-video {
		width: 100%;
		height: 100%;
		object-fit: cover;
		background-color: #000;
	}

	.pip-controls {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		padding: 8px;
		display: flex;
		justify-content: space-between;
		background: linear-gradient(to bottom, rgba(0, 0, 0, 0.7) 0%, transparent 100%);
		opacity: 0;
		transition: opacity 0.2s ease;
	}

	.pip-video-container:hover .pip-controls {
		opacity: 1;
	}

	.pip-btn {
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
		transition: background 0.2s ease;
	}

	.pip-btn:hover {
		background: rgba(0, 0, 0, 0.8);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
