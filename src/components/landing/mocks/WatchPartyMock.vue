<script setup lang="ts">
	import { ref, computed, onMounted, onUnmounted } from 'vue';
	import { Icon } from '@iconify/vue';

	type Scene = {
		video: number;
		title?: string;
		thumbnail?: string;
		duration: number;
		start: number;
		playing: boolean;
		watchers: number;
	};

	const scenes: Scene[] = [
		{
			video: 1,
			title: 'Dövüş Kulübü',
			thumbnail:
				'https://occ-0-7289-2774.1.nflxso.net/dnm/api/v6/0Qzqdxw-HG1AiOKLWWPsFOUDA2E/AAAABRYdJLPMgcUgR9PnYCPJRD7xvDG6PiEhkhe0JnKeO6upWlTAYqFXuqmQQgsnUsLL8GSebniftLBbIoY4Az9JQBmUjgVsLreMpqAD.webp?r=1dc',
			duration: 8352218,
			start: 3758498,
			playing: true,
			watchers: 4,
		},
		{
			video: 2,
			title: 'Breaking Bad · S5:E7 · Adımı Söyle',
			thumbnail:
				'https://occ-0-7289-2774.1.nflxso.net/dnm/api/v6/9pS1daC2n6UGc3dUogvWIPMR_OU/AAAABVwJNHIiyVvPyBe9T7LwujmHhVlfdExxI4Mc0wqacDn9QenuAfXdSyte7Ti06JfodTYk_vNhm9FhHXjD2JTge5juG1Bmh4nocN5v4-WaxDMiOG170XQy9X12.webp?r=b33',
			duration: 2848929,
			start: 2051228,
			playing: false,
			watchers: 3,
		},
		{
			video: 3,
			title: '100 Meters',
			thumbnail:
				'https://occ-0-7289-2774.1.nflxso.net/dnm/api/v6/0Qzqdxw-HG1AiOKLWWPsFOUDA2E/AAAABQaARm02QMngNmWX6bgCTSFgW5Octq6rqGkjC-l4EGDktxFSHRtFOHIBuIgzcteqL15SDvkLtZTZz9E980E7LztI6UbBcO98-pVW.webp?r=d24',
			duration: 6431425,
			start: 964713,
			playing: true,
			watchers: 5,
		},
		{
			video: 4,
			title: 'Bir Konuşabilse...',
			thumbnail:
				'https://occ-0-7289-2774.1.nflxso.net/dnm/api/v6/0Qzqdxw-HG1AiOKLWWPsFOUDA2E/AAAABXDYLq6_-KYlw-vnpXfg8p7qN-0o3PvKY5-X7Gumi5-ywdYGavQxVHbSdlkxhHNgohWYh4JIkkgJ8jNji5cg5wjatWeJBdOCjBDs.webp?r=61b',
			duration: 6100803,
			start: 3538465,
			playing: true,
			watchers: 2,
		},
		{
			video: 5,
			title: 'Yıldızlararası',
			thumbnail:
				'https://occ-0-7289-2774.1.nflxso.net/dnm/api/v6/0Qzqdxw-HG1AiOKLWWPsFOUDA2E/AAAABXXkGEKLHSixZeWKYav5yzTe82Kb21stRYmtxmfQ0yPAQ5ZienFFCxbnAFEEIQ3H57BkFwFUEBF-GXPJBSqNEve8LS1kQqZBVHdH.webp?r=b01',
			duration: 10141965,
			start: 8924929,
			playing: false,
			watchers: 6,
		},
		{
			video: 0,
			duration: 0,
			start: 0,
			playing: true,
			watchers: 5,
		},
	];

	const idx = ref(Math.floor(Math.random() * scenes.length));
	const scene = computed(() => scenes[idx.value]);

	const thumbBroken = ref(false);
	const thumbnail = computed(() => (thumbBroken.value ? undefined : scene.value.thumbnail));

	const currentMs = ref(scene.value.start);

	let tickTimer: ReturnType<typeof setInterval>;
	let cycleTimer: ReturnType<typeof setInterval>;

	const cycle = () => {
		let next = Math.floor(Math.random() * scenes.length);
		if (next === idx.value) next = (next + 1) % scenes.length;
		idx.value = next;
		thumbBroken.value = false;
		currentMs.value = scene.value.start;
	};

	onMounted(() => {
		tickTimer = setInterval(() => {
			const s = scene.value;
			if (!s.playing || s.video === 0) return;
			currentMs.value = s.duration > 0 ? Math.min(s.duration, currentMs.value + 1000) : currentMs.value + 1000;
		}, 1000);

		cycleTimer = setInterval(cycle, 5000);
	});

	onUnmounted(() => {
		clearInterval(tickTimer);
		clearInterval(cycleTimer);
	});

	const progressPct = computed(() => {
		const d = scene.value.duration;
		if (!d || d <= 0) return 0;
		return Math.min(100, Math.max(0, (currentMs.value / d) * 100));
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
</script>

<template>
	<div class="wp-mock">
		<Transition name="wp-fade" mode="out-in">
			<div class="wp-player" :key="idx">
				<div class="wp-thumb-wrapper" :class="{ 'wp-thumb-placeholder': !thumbnail }">
					<img v-if="thumbnail" :src="thumbnail" class="wp-thumb" alt="thumbnail" @error="thumbBroken = true" />
					<template v-else>
						<div class="wp-placeholder-bg">
							<img src="/netflix-n.svg" class="wp-netflix-n" alt="" />
						</div>
					</template>
					<div class="wp-thumb-overlay">
						<Icon v-if="thumbnail" icon="tdesign:film-filled" class="wp-thumb-icon" />
					</div>
					<Transition name="wp-pause-fade">
						<div v-if="!scene.playing && scene.video !== 0" class="wp-pause-overlay">
							<div class="wp-pause-circle">
								<Icon icon="mdi:pause" />
							</div>
						</div>
					</Transition>
				</div>

				<div class="wp-body">
					<span class="wp-label">Watch Party</span>

					<div class="wp-title" :title="scene.video === 0 ? 'Home Page' : scene.title || `Video #${scene.video}`">
						{{ scene.video === 0 ? 'Home Page' : scene.title || `Video #${scene.video}` }}
					</div>

					<div v-if="scene.video !== 0" class="wp-meta">
						<div v-if="scene.duration && scene.duration > 0" class="wp-progress-container">
							<div class="wp-progress-bar">
								<div class="wp-progress-fill" :style="{ width: progressPct + '%' }"></div>
							</div>
							<div class="wp-time">
								<span>{{ formatTime(currentMs) }}</span>
								<span>{{ formatTime(scene.duration) }}</span>
							</div>
						</div>
						<div v-else class="wp-time-simple">
							<Icon icon="mdi:clock-outline" />
							<span>{{ formatTime(currentMs) }}</span>
						</div>
					</div>

					<div class="wp-watchers">
						<Icon icon="mdi:account-multiple" class="wp-watchers-icon" />
						<span>{{ scene.watchers }} {{ scene.video === 0 ? 'in party' : 'watching' }}</span>
					</div>
				</div>
			</div>
		</Transition>
	</div>
</template>

<style scoped>
	.wp-mock {
		height: 100%;
		width: clamp(300px, 95cqw, 360px);
		background: var(--bg-darker);
		text-align: left;
		overflow: hidden;
	}

	.wp-player {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
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
		padding: 14px 16px 16px;
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

	.wp-watchers {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 0.75rem;
		color: var(--text-muted, #8e9197);
		margin-top: 2px;
	}

	.wp-watchers-icon {
		font-size: 0.9rem;
	}

	.wp-title {
		font-size: 1rem;
		font-weight: 700;
		color: var(--text, #e1e3e6);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.wp-meta {
		min-height: 26px;
		display: flex;
		flex-direction: column;
		justify-content: center;
	}

	.wp-progress-container {
		display: flex;
		flex-direction: column;
		gap: 6px;
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

	.wp-fade-enter-active,
	.wp-fade-leave-active {
		transition:
			opacity 0.4s ease,
			transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.wp-fade-enter-from {
		opacity: 0;
		transform: scale(0.96);
	}

	.wp-fade-leave-to {
		opacity: 0;
		transform: scale(1.02);
	}
</style>
