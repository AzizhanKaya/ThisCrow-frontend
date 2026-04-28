<script setup lang="ts">
	import { computed, ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
	import type { User, Activity } from '@/types';
	import { Status } from '@/types';
	import { useMeStore } from '@/stores/me';
	import { useFriendStore } from '@/stores/friend';
	import { useRouter } from 'vue-router';
	import { getDefaultAvatar } from '@/utils/avatar';
	import { Icon } from '@iconify/vue';
	import { useModalStore, ModalView } from '@/stores/modal';

	const props = defineProps<{
		user: User;
		show?: boolean;
		x?: number;
		y?: number;
	}>();

	const emit = defineEmits<{
		(e: 'close'): void;
	}>();

	const meStore = useMeStore();
	const friendStore = useFriendStore();
	const router = useRouter();
	const modalStore = useModalStore();

	const user = computed(() => {
		return props.user;
	});
	const me = computed(() => meStore.me);

	const handleAddFriend = () => {
		friendStore.sendFriendRequest(user.value);
	};

	const handleMessage = () => {
		router.push({ name: 'user', params: { userId: user.value.id.toString() } });
		emit('close');
	};

	const openModalProfile = () => {
		emit('close');
		modalStore.openModal(ModalView.PROFILE_CARD, { user: user.value });
	};

	const mutualFriendsCount = computed(() => {
		if (!user.value.friends || !me.value?.friends) return 0;
		return user.value.friends.filter((f) => me.value!.friends.includes(f)).length;
	});

	const mutualServersCount = computed(() => {
		if (!user.value.groups || !me.value?.groups) return 0;
		return user.value.groups.filter((g) => me.value!.groups.includes(g)).length;
	});

	const getStatusClass = computed(() => {
		switch (user.value.status) {
			case Status.Online:
				return 'status-online';
			case Status.Idle:
				return 'status-idle';
			case Status.Dnd:
				return 'status-dnd';
			case Status.Offline:
			default:
				return 'status-offline';
		}
	});

	const hasActivities = computed(() => {
		const acts = user.value.activities;
		if (!acts) return false;
		return Object.keys(acts).length > 0;
	});

	const getMusicProgress = (activity: any) => {
		if (activity.paused) return Number(activity.offset);
		return Math.max(0, now.value - Number(activity.offset));
	};

	const formatMS = (ms: number) => {
		const totalSeconds = Math.floor(ms / 1000);
		const mins = Math.floor(totalSeconds / 60);
		const secs = totalSeconds % 60;
		return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
	};

	const now = ref(Date.now());
	let timer: ReturnType<typeof setInterval>;

	const cardRef = ref<HTMLElement | null>(null);

	const handleClickOutside = (event: MouseEvent) => {
		if (cardRef.value && !cardRef.value.contains(event.target as Node)) {
			emit('close');
		}
	};

	const updatePosition = async () => {
		await nextTick();
		if (cardRef.value && props.x !== undefined && props.y !== undefined) {
			const width = cardRef.value.offsetWidth;
			const height = cardRef.value.offsetHeight;
			const viewportWidth = window.innerWidth;
			const viewportHeight = window.innerHeight;

			let finalX = props.x;
			let finalY = props.y;

			if (finalX + width > viewportWidth) {
				finalX = viewportWidth - width - 10;
			}

			if (finalY + height > viewportHeight) {
				finalY = viewportHeight - height - 10;
			}

			if (finalX < 10) finalX = 10;
			if (finalY < 10) finalY = 10;

			cardRef.value.style.left = `${finalX}px`;
			cardRef.value.style.top = `${finalY}px`;
		}
	};

	watch(
		() => [props.show, props.x, props.y],
		async ([newShow]) => {
			if (newShow === undefined) return;
			if (newShow) {
				requestAnimationFrame(() => {
					document.addEventListener('click', handleClickOutside);
					document.addEventListener('contextmenu', handleClickOutside);
				});
				await updatePosition();
			} else {
				document.removeEventListener('click', handleClickOutside);
				document.removeEventListener('contextmenu', handleClickOutside);
			}
		},
		{ immediate: true, deep: true }
	);

	let resizeObserver: ResizeObserver | null = null;

	onMounted(() => {
		timer = setInterval(() => {
			now.value = Date.now();
		}, 1000);

		window.addEventListener('resize', updatePosition);

		if (cardRef.value) {
			resizeObserver = new ResizeObserver(() => {
				updatePosition();
			});
			resizeObserver.observe(cardRef.value);
		}
	});

	onUnmounted(() => {
		clearInterval(timer);
		document.removeEventListener('click', handleClickOutside);
		document.removeEventListener('contextmenu', handleClickOutside);
		window.removeEventListener('resize', updatePosition);
		if (resizeObserver) {
			resizeObserver.disconnect();
		}
	});

	const formatTimeElapsed = (dateString: Date | string | number) => {
		const start = new Date(dateString).getTime();
		const elapsed = now.value - start;
		if (elapsed < 0) return '00:00';

		const totalSeconds = Math.floor(elapsed / 1000);
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;

		if (hours > 0) {
			return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
		}
		return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
	};
</script>

<template>
	<Transition name="profile-card-transition">
		<div
			v-show="show === undefined || show"
			class="profile-card"
			:class="{ 'is-popover': show !== undefined }"
			ref="cardRef"
			@click.stop
			@contextmenu.prevent="() => {}"
		>
			<div
				class="banner"
				:style="user.banner ? { backgroundImage: `url(${user.banner})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}"
			></div>

			<div class="avatar-wrapper">
				<img class="avatar avatar-hoverable" :src="user.avatar || getDefaultAvatar(user.username)" @click="openModalProfile" />
				<div class="status-indicator" :class="getStatusClass"></div>
			</div>

			<div class="quick-actions" v-if="me && me.id !== user.id">
				<button class="quick-btn" title="Friend" disabled v-if="friendStore.isFriend(user.id)">
					<Icon icon="mdi:account-check" />
				</button>
				<button class="quick-btn" title="Request Sent" disabled v-else-if="friendStore.isRequestSent(user.id)">
					<Icon icon="mdi:account-clock" />
				</button>
				<button class="quick-btn" title="Add Friend" @click.stop="handleAddFriend" v-else>
					<Icon icon="mdi:account-plus" />
				</button>
				<button class="quick-btn" title="Send Message" @click.stop="handleMessage">
					<Icon icon="mdi:message" />
				</button>
			</div>

			<div class="card-inner">
				<div class="user-info-section">
					<div class="user-info-left">
						<h2 class="name">{{ user.name }}</h2>
						<span class="username">@{{ user.username }}</span>
					</div>
					<div class="mutuals-right" v-if="me && me.id !== props.user.id">
						<div class="mutual-row">
							<Icon icon="mdi:account-multiple" class="mutual-icon" />
							<span>{{ mutualFriendsCount }} Friends</span>
						</div>
						<div class="mutual-row">
							<Icon icon="mdi:server" class="mutual-icon" />
							<span>{{ mutualServersCount }} Servers</span>
						</div>
					</div>
				</div>

				<div class="divider"></div>

				<!-- Activities -->
				<div v-if="hasActivities && user.activities" class="activities-section">
					<h3 class="section-title">Activity</h3>

					<div class="activity-list">
						<!-- Game Activity -->
						<div v-if="user.activities.game" class="activity-item">
							<div class="activity-icon-wrapper">
								<img
									v-if="user.activities.game.payload.header_image"
									:src="user.activities.game.payload.header_image"
									class="activity-image"
								/>
								<Icon v-else icon="mdi:controller" class="activity-icon" />
							</div>
							<div class="activity-content">
								<span class="activity-title text-truncate">Playing</span>
								<span class="activity-name text-truncate">{{ user.activities.game.payload.name || 'Game' }}</span>
								<span class="activity-detail text-truncate"
									>{{ formatTimeElapsed(Number(user.activities.game.payload.start_time)) }} elapsed</span
								>
							</div>
						</div>

						<!-- Music Activity -->
						<div v-if="user.activities.music" class="activity-item">
							<div class="activity-icon-wrapper">
								<img
									v-if="user.activities.music.payload.album_url"
									:src="user.activities.music.payload.album_url"
									class="activity-image"
								/>
								<Icon v-else icon="mdi:music" class="activity-icon" />
							</div>
							<div class="activity-content">
								<span class="activity-title text-truncate">{{ user.activities.music.payload.paused ? 'Paused' : 'Listening' }}</span>
								<span class="activity-name text-truncate">{{ user.activities.music.payload.title }}</span>
								<span class="activity-detail text-truncate">
									{{ user.activities.music.payload.artist
									}}<template v-if="user.activities.music.payload.album">, {{ user.activities.music.payload.album }}</template>
								</span>

								<div class="music-progress-container">
									<div class="music-progress-bar">
										<div
											class="music-progress-fill"
											:style="{
												width:
													Math.min(
														100,
														(getMusicProgress(user.activities.music.payload) / (user.activities.music.payload.length * 1000)) * 100
													) + '%',
											}"
										></div>
									</div>
									<div class="music-time">
										<span>{{ formatMS(getMusicProgress(user.activities.music.payload)) }}</span>
										<span>{{ formatMS(user.activities.music.payload.length * 1000) }}</span>
									</div>
								</div>
							</div>
						</div>

						<!-- Watching Activity -->
						<div v-if="user.activities.watching" class="activity-item">
							<div class="activity-icon-wrapper">
								<Icon icon="mdi:play-network" class="activity-icon" />
							</div>
							<div class="activity-content">
								<span class="activity-title text-truncate">Watching</span>
								<span class="activity-name text-truncate">Video ID: {{ user.activities.watching.payload.video }}</span>
							</div>
						</div>

						<!-- Streaming Activity -->
						<div v-if="user.activities.streaming" class="activity-item">
							<div class="activity-icon-wrapper">
								<Icon icon="mdi:monitor-share" class="activity-icon" />
							</div>
							<div class="activity-content">
								<span class="activity-title text-truncate">Streaming</span>
								<span class="activity-name text-truncate">Grup: {{ user.activities.streaming.payload.group_id }}</span>
								<span class="activity-detail text-truncate">Streaming online</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</Transition>
</template>

<style scoped>
	.profile-card-transition-enter-active,
	.profile-card-transition-leave-active {
		transition:
			opacity 0.15s ease,
			transform 0.15s ease;
	}

	.profile-card-transition-enter-from,
	.profile-card-transition-leave-to {
		opacity: 0;
		transform: translateY(5px) scale(0.98);
	}

	.profile-card {
		width: 340px;
		background-color: var(--bg-darker);
		border-radius: 8px;
		overflow: hidden;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
		display: flex;
		flex-direction: column;
		position: relative;
		font-family: 'Inter', sans-serif;
		max-height: 90vh;
	}

	.profile-card.is-popover {
		position: fixed;
		z-index: 100;
		pointer-events: auto;
	}

	.banner {
		height: 120px;
		background-color: var(--bg-darkest);
		width: 100%;
	}

	.avatar-wrapper {
		position: absolute;
		top: 76px;
		left: 16px;
		width: 92px;
		height: 92px;
		border-radius: 50%;
		background-color: var(--bg-darker);
		padding: 6px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.avatar {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		object-fit: cover;
		transition: filter 0.2s;
	}

	.avatar-hoverable:hover {
		cursor: pointer;
		filter: brightness(0.7);
	}

	.status-indicator {
		position: absolute;
		bottom: 4px;
		right: 4px;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		border: 6px solid var(--bg-darker);
	}

	.quick-actions {
		position: absolute;
		top: 132px;
		right: 16px;
		display: flex;
		gap: 8px;
		z-index: 10;
	}

	.quick-btn {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background-color: var(--bg-dark);
		border: none;
		color: var(--text);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		font-size: 16px;
		transition: all 0.2s;
	}

	.quick-btn:hover {
		background-color: var(--bg-light);
		transform: scale(1.05);
	}

	.card-inner {
		background-color: var(--bg-darker);
		padding: 60px 16px 16px 16px;
		border-radius: 0 0 8px 8px;
		flex: 1;
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: var(--bg-light) transparent;
	}

	.card-inner::-webkit-scrollbar {
		width: 4px;
	}

	.card-inner::-webkit-scrollbar-thumb {
		background-color: var(--bg-light);
		border-radius: 4px;
	}

	.user-info-section {
		background-color: var(--bg-dark);
		border-radius: 8px;
		padding: 12px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.user-info-left {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.name {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text);
		margin: 0 0 2px 0;
	}

	.username {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-muted);
		margin: 0;
	}

	.divider {
		height: 1px;
		background-color: var(--border);
		margin: 12px 0;
	}

	.mutuals-right {
		display: flex;
		flex-direction: column;
		gap: 4px;
		flex-shrink: 0;
		align-items: flex-end;
		text-align: right;
	}

	.mutual-row {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 0.78rem;
		color: var(--text-muted);
		font-weight: 500;
	}

	.mutual-icon {
		font-size: 0.95rem;
	}

	.activities-section {
		padding: 0 12px;
	}

	.section-title {
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		color: var(--text-muted);
		margin: 0 0 12px 0;
		letter-spacing: 0.02em;
	}

	.activity-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.activity-item {
		display: flex;
		gap: 12px;
		align-items: stretch;
		background-color: var(--bg-dark);
		padding: 12px;
		border-radius: 8px;
	}

	.activity-icon-wrapper {
		width: 80px;
		height: 80px;
		border-radius: 8px;
		background-color: var(--bg-light);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		overflow: hidden;
	}

	.activity-icon {
		font-size: 32px;
		color: var(--text);
	}

	.activity-image {
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
	}

	.text-truncate {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.activity-title {
		font-size: 0.65rem;
		font-weight: 800;
		text-transform: uppercase;
		color: var(--text-muted);
		margin-bottom: 6px;
		letter-spacing: 0.04em;
		line-height: 1;
	}

	.activity-name {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text);
		margin-bottom: 2px;
	}

	.activity-detail {
		font-size: 0.875rem;
		color: var(--text-muted);
	}

	.music-progress-container {
		margin-top: 8px;
		width: 100%;
	}

	.music-progress-bar {
		height: 4px;
		background-color: var(--bg-light);
		border-radius: 2px;
		width: 100%;
		overflow: hidden;
	}

	.music-progress-fill {
		height: 100%;
		background-color: #1db954; /* Spotify Green */
		border-radius: 2px;
		transition: width 0.1s linear;
	}

	.music-time {
		display: flex;
		justify-content: space-between;
		font-size: 0.75rem;
		color: var(--text-muted, #b5bac1);
		margin-top: 4px;
	}
</style>
