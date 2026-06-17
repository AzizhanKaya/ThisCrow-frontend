<script setup lang="ts">
	import { ref, computed, onMounted, onUnmounted } from 'vue';

	const games = [
		{
			name: 'Elden Ring',
			header_image:
				'https://shared.fastly.steamstatic.com/community_assets/images/apps/1245620/2e048bfc2073ca30804ed5b8c454a9ca0e2f98de.ico',
		},
		{
			name: 'Counter-Strike 2',
			header_image:
				'https://shared.fastly.steamstatic.com/community_assets/images/apps/730/324b323045b09bace182f928f4104dfcd93cb7f3.ico',
		},
		{
			name: 'Stardew Valley',
			header_image:
				'https://shared.fastly.steamstatic.com/community_assets/images/apps/413150/913064b27b4b25e2c03cbd261a8b03fd67da693c.ico',
		},
	];

	const songs = [
		{
			title: "Can't Feel My Face",
			artist: 'The Weeknd',
			album: 'Beauty Behind The Madness',
			album_url: 'https://i.scdn.co/image/ab67616d0000b2737fcead687e99583072cc217b',
			length: 214,
		},
		{
			title: 'Stabilisers For Big Boys',
			artist: 'Panchiko',
			album: 'D>E>A>T>H>M>E>T>A>L',
			album_url: 'https://i.scdn.co/image/ab67616d0000b273e045aa197ada995407bf92fc',
			length: 252,
		},
		{
			title: 'YEAH RIGHT',
			artist: 'Joji',
			album: 'BALLADS 1',
			album_url: 'https://i.scdn.co/image/ab67616d0000b2734cc52cd7a712842234e4fce2',
			length: 174,
		},
	];

	const randomBetween = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

	const currentGameIndex = ref(Math.floor(Math.random() * games.length));
	const currentSongIndex = ref(Math.floor(Math.random() * songs.length));

	const currentGame = computed(() => games[currentGameIndex.value]);
	const currentSong = computed(() => songs[currentSongIndex.value]);

	const gameElapsed = ref(randomBetween(20 * 60, 2 * 60 * 60));
	const songElapsed = ref(randomBetween(10, songs[currentSongIndex.value].length - 10));

	let tickTimer: ReturnType<typeof setInterval>;
	let cycleTimer: ReturnType<typeof setInterval>;

	const cycle = () => {
		let nextGameIndex = Math.floor(Math.random() * games.length);
		if (nextGameIndex === currentGameIndex.value) {
			nextGameIndex = (nextGameIndex + 1) % games.length;
		}
		currentGameIndex.value = nextGameIndex;
		gameElapsed.value = randomBetween(20 * 60, 2 * 60 * 60);

		let nextSongIndex = Math.floor(Math.random() * songs.length);
		if (nextSongIndex === currentSongIndex.value) {
			nextSongIndex = (nextSongIndex + 1) % songs.length;
		}
		currentSongIndex.value = nextSongIndex;
		songElapsed.value = randomBetween(10, songs[currentSongIndex.value].length - 10);
	};

	onMounted(() => {
		tickTimer = setInterval(() => {
			gameElapsed.value++;
			songElapsed.value++;
			if (songElapsed.value > currentSong.value.length) {
				songElapsed.value = currentSong.value.length;
			}
		}, 1000);

		cycleTimer = setInterval(cycle, 5000);
	});

	onUnmounted(() => {
		clearInterval(tickTimer);
		clearInterval(cycleTimer);
	});

	const formatTime = (seconds: number) => {
		const hours = Math.floor(seconds / 3600);
		const mins = Math.floor((seconds % 3600) / 60);
		const secs = seconds % 60;
		if (hours > 0) {
			return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
		}
		return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
	};

	const songProgress = computed(() => {
		return Math.min(100, (songElapsed.value / currentSong.value.length) * 100);
	});

	const formatSongTime = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	};
</script>

<template>
	<div class="activity-mock">
		<div class="activity-list">
			<!-- Game Activity -->
			<Transition name="activity-fade" mode="out-in">
				<div class="activity-item" :key="'game-' + currentGameIndex">
					<div class="activity-icon-wrapper">
						<img :src="currentGame.header_image" class="activity-image" />
					</div>
					<div class="activity-content">
						<span class="activity-title">Playing</span>
						<span class="activity-name">{{ currentGame.name }}</span>
						<span class="activity-detail">{{ formatTime(gameElapsed) }} elapsed</span>
					</div>
				</div>
			</Transition>

			<!-- Music Activity -->
			<Transition name="activity-fade" mode="out-in">
				<div class="activity-item" :key="'song-' + currentSongIndex">
					<div class="activity-icon-wrapper music-icon">
						<img :src="currentSong.album_url" class="album-art" />
					</div>
					<div class="activity-content">
						<span class="activity-title">Listening</span>
						<span class="activity-name">{{ currentSong.title }}</span>
						<span class="activity-detail">{{ currentSong.artist }}, {{ currentSong.album }}</span>
						<div class="music-progress-container">
							<div class="music-progress-bar">
								<div class="music-progress-fill" :style="{ width: songProgress + '%' }"></div>
							</div>
							<div class="music-time">
								<span>{{ formatSongTime(songElapsed) }}</span>
								<span>{{ formatSongTime(currentSong.length) }}</span>
							</div>
						</div>
					</div>
				</div>
			</Transition>
		</div>
	</div>
</template>

<style scoped>
	.activity-mock {
		height: 100%;
		width: clamp(300px, 95cqw, 460px);
		background: var(--bg-dark);
		padding: 20px;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		text-align: left;
		overflow: hidden;
	}

	.activity-list {
		display: flex;
		flex-direction: column;
		gap: 14px;
		width: 100%;
		min-height: 238px;
	}

	.activity-item {
		display: flex;
		gap: 16px;
		align-items: stretch;
		background-color: var(--bg-darker);
		padding: 16px;
		border-radius: 12px;
		border: 1px solid hsla(0, 0%, 100%, 0.05);
		min-height: 112px;
	}

	.activity-icon-wrapper {
		width: 80px;
		height: 80px;
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		overflow: hidden;
		position: relative;
	}

	.activity-image {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.music-icon {
		background: var(--bg-light);
	}

	.album-art {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.activity-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		overflow: hidden;
		min-width: 0;
	}

	.activity-title {
		font-size: 0.65rem;
		font-weight: 800;
		text-transform: uppercase;
		color: var(--text-muted);
		margin-bottom: 5px;
		letter-spacing: 0.04em;
		line-height: 1;
	}

	.activity-name {
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--text);
		margin-bottom: 2px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.activity-detail {
		font-size: 0.8rem;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.music-progress-container {
		margin-top: 8px;
		width: 100%;
	}

	.music-progress-bar {
		height: 4px;
		background-color: hsla(0, 0%, 100%, 0.1);
		border-radius: 2px;
		width: 100%;
		overflow: hidden;
	}

	.music-progress-fill {
		height: 100%;
		background-color: #1db954;
		border-radius: 2px;
		transition: width 0.3s linear;
	}

	.music-time {
		display: flex;
		justify-content: space-between;
		font-size: 0.7rem;
		color: var(--text-subtle);
		margin-top: 3px;
	}

	/* Transition */
	.activity-fade-enter-active,
	.activity-fade-leave-active {
		transition:
			opacity 0.35s ease,
			transform 0.35s ease;
	}

	.activity-fade-enter-from {
		opacity: 0;
		transform: translateY(8px);
	}

	.activity-fade-leave-to {
		opacity: 0;
		transform: translateY(-8px);
	}
</style>
