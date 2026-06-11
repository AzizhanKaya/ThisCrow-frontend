<script setup lang="ts">
	import { computed, ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
	import { useServerStore } from '@/stores/server';
	import { useWatchPartyCardStore } from '@/stores/watchPartyCard';
	import { Icon } from '@iconify/vue';

	const serverStore = useServerStore();
	const cardStore = useWatchPartyCardStore();

	const show = computed(() => cardStore.show);

	const party = computed(() => {
		const sid = cardStore.server_id;
		const cid = cardStore.channel_id;
		if (sid === undefined || cid === undefined) return undefined;
		return serverStore.servers.get(sid)?.channels?.get(cid)?.watch_party;
	});

	const now = ref(Date.now());
	let timer: ReturnType<typeof setInterval> | undefined;

	const currentMs = computed(() => {
		const p = party.value;
		if (!p) return 0;
		return p.playing ? now.value - p.offset : p.offset;
	});

	const progressPct = computed(() => {
		const p = party.value;
		if (!p || !p.duration || p.duration <= 0) return 0;
		return Math.min(100, Math.max(0, (currentMs.value / p.duration) * 100));
	});

	const formatTime = (ms: number) => {
		if (!isFinite(ms) || ms < 0) ms = 0;
		const totalSeconds = Math.floor(ms / 1000);
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;
		if (hours > 0) {
			return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
		}
		return `${minutes}:${seconds.toString().padStart(2, '0')}`;
	};

	const cardRef = ref<HTMLElement | null>(null);

	let rAfLoopId: number | null = null;
	let initialTargetOffsetX = 0;
	let initialTargetOffsetY = 0;
	let resizeObserver: ResizeObserver | null = null;

	const updatePosition = async (isInitial = false) => {
		if (isInitial) await nextTick();
		if (!cardRef.value) return;

		const width = cardRef.value.offsetWidth;
		const height = cardRef.value.offsetHeight;
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;

		let finalX = cardStore.x;
		let finalY = cardStore.y;

		if (isInitial) {
			if (finalX + width > viewportWidth) finalX = viewportWidth - width - 10;
			if (finalY + height > viewportHeight) finalY = viewportHeight - height - 10;
			if (finalX < 10) finalX = 10;
			if (finalY < 10) finalY = 10;

			if (cardStore.target) {
				const rect = cardStore.target.getBoundingClientRect();
				initialTargetOffsetX = finalX - rect.left;
				initialTargetOffsetY = finalY - rect.top;
			}
		} else if (cardStore.target) {
			const rect = cardStore.target.getBoundingClientRect();
			finalX = rect.left + initialTargetOffsetX;
			finalY = rect.top + initialTargetOffsetY;
		}

		cardRef.value.style.left = `${finalX}px`;
		cardRef.value.style.top = `${finalY}px`;
	};

	const positionLoop = () => {
		if (show.value && cardStore.target) {
			updatePosition(false);
			rAfLoopId = requestAnimationFrame(positionLoop);
		}
	};

	const handleResize = () => updatePosition(false);

	watch(
		show,
		async (newShow) => {
			if (newShow) {
				await nextTick();
				await updatePosition(true);
				if (cardStore.target) {
					rAfLoopId = requestAnimationFrame(positionLoop);
				}
				window.addEventListener('resize', handleResize);
				if (cardRef.value) {
					resizeObserver = new ResizeObserver(() => updatePosition(false));
					resizeObserver.observe(cardRef.value);
				}
			} else {
				if (rAfLoopId !== null) {
					cancelAnimationFrame(rAfLoopId);
					rAfLoopId = null;
				}
				window.removeEventListener('resize', handleResize);
				if (resizeObserver) {
					resizeObserver.disconnect();
					resizeObserver = null;
				}
			}
		},
		{ immediate: true }
	);

	onMounted(() => {
		timer = setInterval(() => {
			now.value = Date.now();
		}, 1000);
	});

	onUnmounted(() => {
		if (timer) clearInterval(timer);
		if (rAfLoopId !== null) cancelAnimationFrame(rAfLoopId);
		window.removeEventListener('resize', handleResize);
		if (resizeObserver) resizeObserver.disconnect();
	});
</script>

<template>
	<Transition name="wp-card-transition">
		<div v-if="show && party" class="wp-hover-card" :style="{ zIndex: cardStore.zIndex }" ref="cardRef">
			<div class="wp-thumb-wrapper" :class="{ 'wp-thumb-placeholder': !party.thumbnail }">
				<img v-if="party.thumbnail" :src="party.thumbnail" class="wp-thumb" alt="thumbnail" />
				<template v-else>
					<div class="wp-placeholder-bg">
						<img src="/netflix-n.svg" class="wp-netflix-n" alt="" />
					</div>
				</template>
				<div class="wp-thumb-overlay">
					<Icon v-if="party.thumbnail" icon="tdesign:film-filled" class="wp-thumb-icon" />
				</div>
				<Transition name="wp-pause-fade">
					<div v-if="!party.playing && party.video !== 0" class="wp-pause-overlay">
						<div class="wp-pause-circle">
							<Icon icon="mdi:pause" />
						</div>
					</div>
				</Transition>
			</div>

			<div class="wp-body">
				<div class="wp-title" :title="party.video === 0 ? 'Home Page' : (party.title || `Video #${party.video}`)">
					{{ party.video === 0 ? 'Home Page' : (party.title || `Video #${party.video}`) }}
				</div>

				<template v-if="party.video !== 0">
					<div v-if="party.duration && party.duration > 0" class="wp-progress-container">
						<div class="wp-progress-bar">
							<div class="wp-progress-fill" :style="{ width: progressPct + '%' }"></div>
						</div>
						<div class="wp-time">
							<span>{{ formatTime(currentMs) }}</span>
							<span>{{ formatTime(party.duration) }}</span>
						</div>
					</div>
					<div v-else class="wp-time-simple">
						<Icon icon="mdi:clock-outline" />
						<span>{{ formatTime(currentMs) }}</span>
					</div>
				</template>

				<div class="wp-watchers">
					<Icon icon="mdi:account-multiple" />
					<span>{{ party.users.length }} {{ party.video === 0 ? 'in party' : 'watching' }}</span>
				</div>
			</div>
		</div>
	</Transition>
</template>

<style scoped>
	.wp-hover-card {
		position: fixed;
		width: 320px;
		background-color: var(--bg-darker, #1a1d21);
		border: 1px solid var(--border, #2a2d31);
		border-radius: 10px;
		overflow: hidden;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.55);
		pointer-events: none;
	}

	.wp-thumb-wrapper {
		position: relative;
		width: 100%;
		aspect-ratio: 16 / 9;
		background-color: var(--bg-dark, #14171a);
		overflow: hidden;
	}

	.wp-thumb {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.wp-thumb-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.wp-placeholder-bg {
		position: absolute;
		inset: 0;
		background: linear-gradient(135deg, #0a0a0a 0%, #1a0a0c 40%, #2d0f13 70%, #141414 100%);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.wp-netflix-n {
		width: 80px;
		height: auto;
		opacity: 0.35;
		filter: drop-shadow(0 0 20px rgba(229, 9, 20, 0.15));
		user-select: none;
		pointer-events: none;
	}

	.wp-thumb-overlay {
		position: absolute;
		inset: 0;
		background: linear-gradient(to bottom, transparent 50%, rgba(0, 0, 0, 0.55) 100%);
		display: flex;
		align-items: flex-end;
		padding: 8px 10px;
	}

	.wp-thumb-icon {
		font-size: 1.1rem;
		color: white;
		opacity: 0.92;
	}

	.wp-pause-overlay {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 2;
	}

	.wp-pause-circle {
		width: 40px;
		height: 40px;
		background: rgba(255, 255, 255, 0.15);
		backdrop-filter: blur(4px);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: rgba(255, 255, 255, 0.9);
		font-size: 22px;
		box-shadow: 0 0 12px rgba(0, 0, 0, 0.3);
	}

	.wp-pause-fade-enter-active,
	.wp-pause-fade-leave-active {
		transition: opacity 0.2s ease;
	}

	.wp-pause-fade-enter-from,
	.wp-pause-fade-leave-to {
		opacity: 0;
	}

	.wp-body {
		padding: 12px 14px 14px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.wp-label {
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted, #8e9197);
		font-weight: 600;
	}

	.wp-title {
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--text, #e1e3e6);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.wp-progress-container {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-top: 2px;
	}

	.wp-progress-bar {
		width: 100%;
		height: 4px;
		background-color: var(--bg-lighter, #2a2d31);
		border-radius: 2px;
		overflow: hidden;
	}

	.wp-progress-fill {
		height: 100%;
		background-color: #e50914;
		border-radius: 2px;
		transition: width 0.4s linear;
	}

	.wp-time {
		display: flex;
		justify-content: space-between;
		font-size: 0.72rem;
		color: var(--text-muted, #8e9197);
		font-variant-numeric: tabular-nums;
	}

	.wp-time-simple {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.78rem;
		color: var(--text-muted, #8e9197);
		font-variant-numeric: tabular-nums;
	}

	.wp-watchers {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.78rem;
		color: var(--text-muted, #8e9197);
		margin-top: 2px;
	}

	.wp-card-transition-enter-active,
	.wp-card-transition-leave-active {
		transition:
			opacity 0.12s ease,
			transform 0.12s ease;
	}

	.wp-card-transition-enter-from,
	.wp-card-transition-leave-to {
		opacity: 0;
		transform: translateX(-4px);
	}
</style>
