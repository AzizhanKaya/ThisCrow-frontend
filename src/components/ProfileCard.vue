<script setup lang="ts">
	import { computed, ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
	import type { User, Activity } from '@/types';
	import { Status } from '@/types';
	import { useMeStore } from '@/stores/me';
	import { useFriendStore } from '@/stores/friend';
	import { useDMStore } from '@/stores/dm';
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
	const me = computed(() => meStore.me);

	const handleAddFriend = () => {
		friendStore.sendFriendRequest(props.user);
	};

	const handleMessage = () => {
		router.push({ name: 'user', params: { userId: props.user.id.toString() } });
		emit('close');
	};

	const openModalProfile = () => {
		emit('close');
		modalStore.openModal(ModalView.PROFILE_CARD, { user: props.user });
	};

	const mutualFriendsCount = computed(() => {
		if (!props.user.friends || !me.value?.friends) return 0;
		return props.user.friends.filter((f) => me.value!.friends.includes(f)).length;
	});

	const mutualServersCount = computed(() => {
		if (!props.user.groups || !me.value?.groups) return 0;
		return props.user.groups.filter((g) => me.value!.groups.includes(g)).length;
	});

	const getStatusClass = computed(() => {
		switch (props.user.status) {
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

	const activities = computed(() => {
		const list: Activity[] = [];
		if (props.user.activity) {
			list.push(props.user.activity);
		}
		return list;
	});

	const now = ref(Date.now());
	let timer: ReturnType<typeof setInterval>;

	const cardRef = ref<HTMLElement | null>(null);

	const handleClickOutside = (event: MouseEvent) => {
		if (cardRef.value && !cardRef.value.contains(event.target as Node)) {
			emit('close');
		}
	};

	watch(
		() => props.show,
		async (newVal) => {
			if (newVal === undefined) return;
			if (newVal) {
				await nextTick();

				requestAnimationFrame(() => {
					document.addEventListener('click', handleClickOutside);
					document.addEventListener('contextmenu', handleClickOutside);
				});

				if (cardRef.value && props.x !== undefined && props.y !== undefined) {
					const width = cardRef.value.offsetWidth;
					const height = cardRef.value.offsetHeight;
					const maxX = window.innerWidth - width;
					const maxY = window.innerHeight - height;

					let finalX = props.x;
					let finalY = props.y;

					if (finalX > maxX) finalX = maxX - 5;
					if (finalY > maxY) finalY = maxY - 5;

					cardRef.value.style.left = `${finalX}px`;
					cardRef.value.style.top = `${finalY}px`;
				}
			} else {
				document.removeEventListener('click', handleClickOutside);
				document.removeEventListener('contextmenu', handleClickOutside);
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
		clearInterval(timer);
		document.removeEventListener('click', handleClickOutside);
		document.removeEventListener('contextmenu', handleClickOutside);
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
			<div class="banner"></div>

			<div class="avatar-wrapper">
				<img
					class="avatar avatar-hoverable"
					:src="props.user.avatar || getDefaultAvatar(props.user.username)"
					@click="openModalProfile"
				/>
				<div class="status-indicator" :class="getStatusClass"></div>
			</div>

			<div class="quick-actions" v-if="me && me.id !== props.user.id">
				<button
					class="quick-btn"
					title="Arkadaş Ekle"
					@click.stop="handleAddFriend"
					v-if="!friendStore.isFriend(props.user.id) && !friendStore.isRequestSent(props.user.id)"
				>
					<Icon icon="mdi:account-plus" />
				</button>
				<button class="quick-btn" title="Mesaj Gönder" @click.stop="handleMessage">
					<Icon icon="mdi:message" />
				</button>
			</div>

			<div class="card-inner">
				<div class="user-info-section">
					<h2 class="name">{{ props.user.name }}</h2>
					<span class="username">{{ props.user.username }}</span>
				</div>

				<div class="divider"></div>

				<!-- User Info: Mutuals & Basic stats -->
				<div class="info-section">
					<div class="mutuals" v-if="me && me.id !== props.user.id">
						<div class="mutual-item">
							<Icon icon="mdi:account-multiple" class="mutual-icon" />
							<span>{{ mutualFriendsCount }} Ortak Arkadaş</span>
						</div>
						<div class="mutual-item">
							<Icon icon="mdi:server" class="mutual-icon" />
							<span>{{ mutualServersCount }} Ortak Sunucu</span>
						</div>
					</div>
				</div>

				<!-- Activities -->
				<div v-if="activities.length > 0" class="activities-section">
					<div class="divider"></div>
					<h3 class="section-title">Aktivite</h3>

					<div class="activity-list">
						<div v-for="(activity, index) in activities" :key="index" class="activity-item">
							<!-- Game Activity -->
							<template v-if="activity.kind === 'Game'">
								<div class="activity-icon-wrapper">
									<Icon icon="mdi:controller" class="activity-icon" />
								</div>
								<div class="activity-content">
									<span class="activity-title text-truncate">Oynuyor</span>
									<span class="activity-name text-truncate">{{ activity.name }}</span>
									<span class="activity-detail text-truncate">{{ formatTimeElapsed(activity.time) }} geçti</span>
								</div>
							</template>

							<!-- Music Activity -->
							<template v-else-if="activity.kind === 'Music'">
								<div class="activity-icon-wrapper">
									<img v-if="activity.album_url" :src="activity.album_url" class="activity-image" />
									<Icon v-else icon="mdi:music" class="activity-icon" />
								</div>
								<div class="activity-content">
									<span class="activity-title text-truncate">Spotify Dinliyor</span>
									<span class="activity-name text-truncate">{{ activity.title }}</span>
									<span class="activity-detail text-truncate">{{ activity.artist }}</span>
									<span class="activity-detail text-truncate">{{ activity.album }}</span>
								</div>
							</template>

							<!-- Watching Activity -->
							<template v-else-if="activity.kind === 'Watching'">
								<div class="activity-icon-wrapper">
									<Icon icon="mdi:play-network" class="activity-icon" />
								</div>
								<div class="activity-content">
									<span class="activity-title text-truncate">İzliyor</span>
									<span class="activity-name text-truncate">Video ID: {{ activity.video }}</span>
								</div>
							</template>

							<!-- Streaming Activity -->
							<template v-else-if="activity.kind === 'Streaming'">
								<div class="activity-icon-wrapper">
									<Icon icon="mdi:monitor-share" class="activity-icon" />
								</div>
								<div class="activity-content">
									<span class="activity-title text-truncate">Yayın Yapıyor</span>
									<span class="activity-name text-truncate">Grup: {{ activity.group_id }}</span>
									<span class="activity-detail text-truncate">Çevrimiçi Olarak İzleniyor</span>
								</div>
							</template>
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
		background-color: var(--bg-darker, #111214);
		border-radius: 8px;
		overflow: hidden;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
		display: flex;
		flex-direction: column;
		position: relative;
		font-family: 'Inter', sans-serif;
	}

	.profile-card.is-popover {
		position: fixed;
		z-index: 100;
		pointer-events: auto;
	}

	.banner {
		height: 120px;
		background-color: var(--bg-light, #1e1f22);
		width: 100%;
	}

	.avatar-wrapper {
		position: absolute;
		top: 76px;
		left: 16px;
		width: 92px;
		height: 92px;
		border-radius: 50%;
		background-color: var(--bg-darker, #111214);
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
		border: 6px solid var(--bg-darker, #111214);
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
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background-color: var(--bg-light, #2b2d31);
		border: none;
		color: var(--text-muted, #b5bac1);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		font-size: 20px;
		transition: all 0.2s;
	}

	.quick-btn:hover {
		background-color: var(--bg-dark, #313338);
		color: var(--text, #f2f3f5);
	}

	.card-inner {
		background-color: var(--bg-darker, #111214);
		padding: 60px 16px 16px 16px;
		border-radius: 0 0 8px 8px;
		flex: 1;
	}

	.user-info-section {
		background-color: var(--bg, #111214);
		border-radius: 8px;
		padding: 12px;
	}

	.name {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text, #f2f3f5);
		margin: 0 0 2px 0;
	}

	.username {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-muted, #b5bac1);
		margin: 0;
	}

	.divider {
		height: 1px;
		background-color: var(--border, #3f4147);
		margin: 12px 0;
	}

	.info-section {
		padding: 0 12px;
	}

	.mutuals {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.mutual-item {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.875rem;
		color: var(--text-muted, #b5bac1);
		font-weight: 500;
	}

	.mutual-icon {
		font-size: 1.2rem;
	}

	.activities-section {
		padding: 0 12px;
	}

	.section-title {
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		color: var(--text-muted, #b5bac1);
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
	}

	.activity-icon-wrapper {
		width: 60px;
		height: 60px;
		border-radius: 8px;
		background-color: var(--bg-light, #2b2d31);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		overflow: hidden;
	}

	.activity-icon {
		font-size: 32px;
		color: var(--text, #f2f3f5);
	}

	.activity-image {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.activity-content {
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
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		color: var(--text-muted, #b5bac1);
		margin-bottom: 2px;
	}

	.activity-name {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text, #f2f3f5);
		margin-bottom: 2px;
	}

	.activity-detail {
		font-size: 0.875rem;
		color: var(--text-muted, #b5bac1);
	}
</style>
