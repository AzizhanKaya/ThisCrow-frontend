<script setup lang="ts">
	import { ref, computed, onMounted, onUnmounted } from 'vue';
	import { useModalStore } from '@/stores/modal';
	import { useMeStore } from '@/stores/me';
	import { useFriendStore } from '@/stores/friend';
	import { useDMStore } from '@/stores/dm';
	import { useRouter } from 'vue-router';
	import { Icon } from '@iconify/vue';
	import { getDefaultAvatar } from '@/utils/avatar';
	import { type User, Status, type Activity } from '@/types';

	import { useServerStore } from '@/stores/server';

	const modalStore = useModalStore();
	const meStore = useMeStore();
	const friendStore = useFriendStore();
	const dmStore = useDMStore();
	const serverStore = useServerStore();
	const router = useRouter();

	const user = computed(() => modalStore.data?.user as User);
	const me = computed(() => meStore.me);

	const activeTab = ref('activity'); // 'activity', 'mutual_friends', 'mutual_servers'

	const mutualFriends = computed(() => {
		if (!user.value?.friends || !me.value?.friends) return [];
		const mutualIds = user.value.friends.filter((f) => me.value!.friends.includes(f));
		return mutualIds.map((id) => friendStore.getFriend(id)).filter(Boolean) as User[];
	});

	const mutualServers = computed(() => {
		if (!user.value?.groups || !me.value?.groups) return [];
		const mutualIds = user.value.groups.filter((g) => me.value!.groups.includes(g));
		return mutualIds.map((id) => serverStore.getServerById(id)).filter(Boolean) as any[];
	});

	const mutualFriendsCount = computed(() => mutualFriends.value.length);
	const mutualServersCount = computed(() => mutualServers.value.length);

	const getStatusClass = computed(() => {
		switch (user.value?.status) {
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
		if (user.value?.activity) {
			list.push(user.value.activity);
		}
		return list;
	});

	const handleAddFriend = () => {
		friendStore.sendFriendRequest(user.value);
	};

	const handleMessage = () => {
		router.push({ name: 'user', params: { userId: user.value.id.toString() } });
		modalStore.closeModal();
	};

	const now = ref(Date.now());
	let timer: ReturnType<typeof setInterval>;
	onMounted(() => {
		timer = setInterval(() => {
			now.value = Date.now();
		}, 1000);
	});
	onUnmounted(() => {
		clearInterval(timer);
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
	<div class="modal-backdrop" @click="modalStore.closeModal">
		<div class="modal-container profile_modal" @click.stop v-if="user">
			<div class="banner">
				<button class="close-btn" @click="modalStore.closeModal">
					<Icon icon="mdi:close" />
				</button>
			</div>

			<div class="header-content">
				<div class="avatar-wrapper">
					<img class="avatar" :src="user.avatar || getDefaultAvatar(user.username)" />
					<div class="status-indicator" :class="getStatusClass"></div>
				</div>

				<div class="actions" v-if="me && me.id !== user.id">
					<button class="action-circle-btn btn-secondary" title="Mesaj Gönder" @click="handleMessage">
						<Icon icon="mdi:message" />
					</button>
					<button class="action-circle-btn btn-secondary" title="Arkadaş Ekle" @click="handleAddFriend">
						<Icon icon="mdi:account-plus" />
					</button>
				</div>
			</div>

			<div class="user-details">
				<h2 class="name">{{ user.name }}</h2>
				<span class="username">{{ user.username }}</span>
			</div>

			<div class="divider"></div>

			<div class="tabs">
				<button class="tab" :class="{ active: activeTab === 'activity' }" @click="activeTab = 'activity'">Aktivite</button>
				<button class="tab" :class="{ active: activeTab === 'mutual_friends' }" @click="activeTab = 'mutual_friends'">
					Ortak Arkadaşlar <span class="badge" v-if="mutualFriendsCount">{{ mutualFriendsCount }}</span>
				</button>
				<button class="tab" :class="{ active: activeTab === 'mutual_servers' }" @click="activeTab = 'mutual_servers'">
					Ortak Sunucular <span class="badge" v-if="mutualServersCount">{{ mutualServersCount }}</span>
				</button>
			</div>

			<div class="tab-content scrollable">
				<!-- Activity Tab -->
				<div v-show="activeTab === 'activity'" class="activity-section">
					<div v-if="activities.length === 0" class="empty-state">
						<Icon icon="mdi:emoticon-sad-outline" class="empty-icon" />
						<p>Şu anda hiçbir aktivite yok.</p>
					</div>
					<div class="activity-list" v-else>
						<div v-for="(activity, index) in activities" :key="index" class="activity-item">
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
							<template v-else-if="activity.kind === 'Watching'">
								<div class="activity-icon-wrapper">
									<Icon icon="mdi:play-network" class="activity-icon" />
								</div>
								<div class="activity-content">
									<span class="activity-title text-truncate">İzliyor</span>
									<span class="activity-name text-truncate">Video ID: {{ activity.video }}</span>
								</div>
							</template>
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

				<!-- Mutual Friends Tab -->
				<div v-show="activeTab === 'mutual_friends'" class="mutual-section">
					<div class="empty-state" v-if="mutualFriendsCount === 0">
						<Icon icon="mdi:account-group" class="empty-icon" />
						<p>Ortak arkadaşınız yok.</p>
					</div>
					<div class="list" v-else>
						<div v-for="friend in mutualFriends" :key="friend.id.toString()" class="list-item">
							<img :src="friend.avatar || getDefaultAvatar(friend.username)" class="item-avatar" />
							<div class="item-info">
								<span class="item-name">{{ friend.name }}</span>
								<span class="item-sub">@{{ friend.username }}</span>
							</div>
						</div>
					</div>
				</div>

				<!-- Mutual Servers Tab -->
				<div v-show="activeTab === 'mutual_servers'" class="mutual-section">
					<div class="empty-state" v-if="mutualServersCount === 0">
						<Icon icon="mdi:server" class="empty-icon" />
						<p>Ortak sunucunuz yok.</p>
					</div>
					<div class="list" v-else>
						<div v-for="server in mutualServers" :key="server.id.toString()" class="list-item">
							<div class="item-avatar server-avatar" v-if="server.icon">
								<img :src="server.icon" />
							</div>
							<div class="item-avatar server-avatar-fallback" v-else>
								{{ server.name ? server.name[0].toUpperCase() : 'S' }}
							</div>
							<div class="item-info">
								<span class="item-name">{{ server.name }}</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<style scoped>
	.profile_modal {
		background-color: var(--bg-darker);
		width: 500px;
		max-width: 90%;
		border-radius: 12px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
		overflow: hidden;
		display: flex;
		flex-direction: column;
		position: relative;
	}

	.banner {
		height: 180px;
		background-color: var(--bg-darkest);
		width: 100%;
		position: relative;
	}

	.close-btn {
		position: absolute;
		top: 16px;
		right: 16px;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background-color: rgba(0, 0, 0, 0.4);
		border: none;
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		font-size: 18px;
		transition: background-color 0.2s;
	}

	.close-btn:hover {
		background-color: rgba(0, 0, 0, 0.6);
	}

	.header-content {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		padding: 0 24px;
		margin-top: -60px;
	}

	.avatar-wrapper {
		position: relative;
		width: 120px;
		height: 120px;
		border-radius: 50%;
		background-color: var(--bg-darker);
		padding: 8px;
	}

	.avatar {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		object-fit: cover;
	}

	.status-indicator {
		position: absolute;
		bottom: 6px;
		right: 6px;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		border: 6px solid var(--bg-darker);
	}

	.actions {
		display: flex;
		gap: 12px;
		margin-bottom: 12px;
	}

	.action-circle-btn {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		font-size: 16px;
		cursor: pointer;
		border: none;
		transition: all 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.btn-primary {
		background-color: var(--color);
		color: #fff;
	}
	.btn-primary:hover {
		filter: brightness(1.1);
		transform: scale(1.05);
	}

	.btn-secondary {
		background-color: var(--bg-dark);
		color: var(--text);
	}
	.btn-secondary:hover {
		background-color: var(--bg-light);
		transform: scale(1.05);
	}

	.user-details {
		padding: 16px 24px;
		background-color: var(--bg-darker);
	}

	.name {
		font-size: 1.5rem;
		font-weight: 700;
		margin: 0 0 4px 0;
		color: var(--text);
	}

	.username {
		font-size: 1rem;
		color: var(--text-muted);
	}

	.divider {
		height: 1px;
		background-color: var(--border);
		margin: 8px 24px;
	}

	.tabs {
		display: flex;
		gap: 24px;
		padding: 0 24px;
		margin-top: 12px;
		position: relative;
	}

	.tab {
		background: none;
		border: none;
		padding: 12px 0;
		font-size: 15px;
		font-weight: 600;
		color: var(--text-muted);
		cursor: pointer;
		position: relative;
		display: flex;
		align-items: center;
		gap: 8px;
		transition: color 0.2s;
	}

	.tab:hover {
		color: var(--text);
	}

	.tab.active {
		color: var(--text);
	}

	.tab.active::after {
		content: '';
		position: absolute;
		bottom: 0;
		left: 0;
		width: 100%;
		height: 2px;
		background-color: var(--color);
		border-radius: 2px 2px 0 0;
	}

	.badge {
		background-color: var(--bg-light);
		color: var(--text);
		font-size: 11px;
		padding: 2px 6px;
		border-radius: 10px;
	}

	.tab-content {
		padding: 20px 24px 32px 24px;
		background-color: var(--bg-darkest);
		min-height: 200px;
		max-height: 400px;
		overflow-y: auto;
	}

	.tab-content::-webkit-scrollbar {
		width: 8px;
		background-color: var(--bg-dark);
	}
	.tab-content::-webkit-scrollbar-thumb {
		background-color: var(--bg-dark);
		border-radius: 4px;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 32px 0;
		color: var(--text-muted);
		text-align: center;
	}

	.empty-icon {
		font-size: 48px;
		margin-bottom: 16px;
		opacity: 0.5;
	}

	.activity-list {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.activity-item {
		display: flex;
		gap: 16px;
		background-color: var(--bg-dark);
		padding: 16px;
		border-radius: 8px;
	}

	.activity-icon-wrapper {
		width: 72px;
		height: 72px;
		border-radius: 12px;
		background-color: var(--bg-light);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		overflow: hidden;
	}

	.activity-icon {
		font-size: 36px;
		color: var(--text);
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
		color: var(--text-muted);
		margin-bottom: 4px;
	}

	.activity-name {
		font-size: 1rem;
		font-weight: 600;
		color: var(--text);
		margin-bottom: 4px;
	}

	.activity-detail {
		font-size: 0.9rem;
		color: var(--text-muted);
	}

	.list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.list-item {
		display: flex;
		align-items: center;
		gap: 16px;
		background-color: var(--bg-dark);
		padding: 12px 16px;
		border-radius: 8px;
		transition: background-color 0.2s;
	}

	.list-item:hover {
		background-color: var(--bg);
	}

	.item-avatar {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		object-fit: cover;
		background-color: var(--bg-dark);
		flex-shrink: 0;
	}

	.server-avatar-fallback {
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 600;
		font-size: 1.2rem;
		color: var(--text);
		border-radius: 12px;
	}

	.server-avatar img {
		width: 100%;
		height: 100%;
		border-radius: 12px;
		object-fit: cover;
	}

	.item-info {
		display: flex;
		flex-direction: column;
	}

	.item-name {
		font-weight: 600;
		color: var(--text);
		font-size: 1rem;
	}

	.item-sub {
		font-size: 0.85rem;
		color: var(--text-muted);
	}
</style>
