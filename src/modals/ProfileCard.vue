<script setup lang="ts">
	import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
	import { useModalStore } from '@/stores/modal';
	import { useMeStore } from '@/stores/me';
	import { useFriendStore } from '@/stores/friend';
	import { useRouter } from 'vue-router';
	import { Icon } from '@iconify/vue';
	import { getDefaultAvatar } from '@/utils/avatar';
	import { type User, Status, type Server, EventType, MessageType, type Message, type Event } from '@/types';
	import { websocketService } from '@/services/websocket';
	import { generate_uid } from '@/utils/uid';
	import { useServerStore } from '@/stores/server';
	import { useFiles } from '@/composables/useFiles';

	const modalStore = useModalStore();
	const meStore = useMeStore();
	const friendStore = useFriendStore();
	const serverStore = useServerStore();
	const router = useRouter();

	const user = $computed(() => {
		return modalStore.data?.user as User;
	});
	const me = $computed(() => meStore.me!);
	const is_me = me.id === user.id;

	const activeTab = ref('activity');

	const isEditingName = ref(false);
	const editName = ref('');
	const nameInputRef = ref<HTMLInputElement | null>(null);

	const startEditName = async () => {
		if (!is_me) return;
		editName.value = user.name;
		isEditingName.value = true;
		await nextTick();
		nameInputRef.value?.focus();
	};

	const saveName = async () => {
		if (editName.value.trim() && editName.value.trim() !== user.name) {
			const newName = editName.value.trim();
			await websocketService.request({
				id: generate_uid(me.id),
				from: me.id,
				to: 0,
				data: {
					event: EventType.UpdateUser,
					payload: { name: newName },
				},
				type: MessageType.Info,
			});
		}

		isEditingName.value = false;
	};

	const displayFriends = $computed(() => {
		if (is_me) {
			if (!me.friends) return [];
			return me.friends.map((id) => friendStore.getFriend(id)).filter(Boolean) as User[];
		}
		if (!user.friends || !me.friends) return [];
		const mutualIds = user.friends.filter((f) => me.friends.includes(f));
		return mutualIds.map((id) => friendStore.getFriend(id)).filter(Boolean) as User[];
	});

	const displayServers = $computed(() => {
		if (is_me) {
			if (!me.groups) return [];
			return me.groups.map((id) => serverStore.getServerById(id)).filter(Boolean) as Server[];
		}
		if (!user?.groups || !me?.groups) return [];
		const mutualIds = user.groups.filter((g) => me!.groups.includes(g));
		return mutualIds.map((id) => serverStore.getServerById(id)).filter(Boolean) as Server[];
	});

	const hasActivities = computed(() => {
		const acts = user.activities;
		if (!acts) return false;
		return Object.keys(acts).length > 0;
	});

	const userStatus = computed(() => {
		switch (user?.status) {
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

	const getMusicProgress = (activity: any) => {
		if (activity.paused) return Number(activity.offset);
		return Math.max(0, now - Number(activity.offset));
	};

	const formatMS = (ms: number) => {
		const totalSeconds = Math.floor(ms / 1000);
		const mins = Math.floor(totalSeconds / 60);
		const secs = totalSeconds % 60;
		return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
	};

	const handleAddFriend = () => {
		friendStore.sendFriendRequest(user);
	};

	const handleMessage = () => {
		router.push({ name: 'user', params: { userId: user.id.toString() } });
		modalStore.closeModal();
	};

	let now = $ref(Date.now());
	let timer: ReturnType<typeof setInterval>;

	onMounted(() => {
		timer = setInterval(() => {
			now = Date.now();
		}, 1000);
	});

	onUnmounted(() => {
		clearInterval(timer);
	});

	const formatTimeElapsed = (dateString: Date | string | number) => {
		const start = new Date(dateString).getTime();
		const elapsed = now - start;
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

	const { uploadFiles } = useFiles();
	const avatarInput = ref<HTMLInputElement | null>(null);
	const isUploadingAvatar = ref(false);

	const bannerInput = ref<HTMLInputElement | null>(null);
	const isUploadingBanner = ref(false);

	const triggerAvatarUpload = () => {
		if (!is_me) return;
		avatarInput.value?.click();
	};

	const handleAvatarSelect = async (event: any) => {
		const files = (event.target as HTMLInputElement).files;
		if (!files || !files[0]) return;

		isUploadingAvatar.value = true;
		try {
			const uploaded = await uploadFiles([files[0]], 'avatar');
			if (uploaded.length > 0) {
				await websocketService.request({
					id: generate_uid(me.id),
					from: me.id,
					to: 0,
					data: {
						event: EventType.UpdateUser,
						payload: { avatar: uploaded[0].url },
					},
					type: MessageType.Info,
				});
			}
		} finally {
			isUploadingAvatar.value = false;
			if (avatarInput.value) avatarInput.value.value = '';
		}
	};

	const triggerBannerUpload = () => {
		if (!is_me) return;
		bannerInput.value?.click();
	};

	const handleBannerSelect = async (event: any) => {
		const files = (event.target as HTMLInputElement).files;
		if (!files || !files[0]) return;

		isUploadingBanner.value = true;
		try {
			const uploaded = await uploadFiles([files[0]], 'banner');
			if (uploaded.length > 0) {
				await websocketService.request({
					id: generate_uid(me.id),
					from: me.id,
					to: 0,
					data: {
						event: EventType.UpdateUser,
						payload: { banner: uploaded[0].url },
					},
					type: MessageType.Info,
				});
			}
		} finally {
			isUploadingBanner.value = false;
			if (bannerInput.value) bannerInput.value.value = '';
		}
	};
</script>

<template>
	<div class="modal-backdrop" @click="modalStore.closeModal">
		<div class="modal-container profile_modal" @click.stop v-if="user">
			<div
				class="banner"
				:class="{ 'is-me': is_me }"
				:style="user.banner ? { backgroundImage: `url(${user.banner})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}"
				@click="triggerBannerUpload"
			>
				<div v-if="is_me" class="banner-edit-overlay">
					<Icon v-if="isUploadingBanner" icon="eos-icons:loading" class="edit-icon spin" />
					<Icon v-else icon="mdi:image" class="edit-icon" />
				</div>
				<input type="file" accept="image/*" ref="bannerInput" @change="handleBannerSelect" hidden />
				<button class="close-btn" @click.stop="modalStore.closeModal">
					<Icon icon="mdi:close" />
				</button>
			</div>

			<div class="header-content">
				<div class="avatar-wrapper" :class="{ 'is-me': is_me }" @click="triggerAvatarUpload">
					<img class="avatar" :src="user.avatar || getDefaultAvatar(user.username)" />
					<div v-if="is_me" class="avatar-edit-overlay">
						<Icon v-if="isUploadingAvatar" icon="eos-icons:loading" class="edit-icon spin" />
						<Icon v-else icon="mdi:camera" class="edit-icon" />
					</div>
					<div class="status-indicator" :class="userStatus"></div>
					<input type="file" accept="image/*" ref="avatarInput" @change="handleAvatarSelect" hidden />
				</div>

				<div class="actions" v-if="me && me.id !== user.id">
					<button class="action-circle-btn btn-secondary" title="Send Message" @click="handleMessage">
						<Icon icon="mdi:message" />
					</button>
					<button class="action-circle-btn btn-secondary" title="Add Friend" @click="handleAddFriend">
						<Icon icon="mdi:account-plus" />
					</button>
				</div>
			</div>

			<div class="user-details">
				<div class="name-container" v-if="isEditingName">
					<input
						ref="nameInputRef"
						type="text"
						maxlength="20"
						v-model="editName"
						class="name-input"
						@keyup.enter="saveName"
						@keyup.escape="isEditingName = false"
						@blur="saveName"
					/>
				</div>
				<h2 class="name" :class="{ 'is-editable': is_me }" @click="startEditName" v-else>
					{{ user.name }}
					<Icon icon="mdi:pencil" class="name-edit-icon" v-if="is_me" />
				</h2>
				<span class="username">@{{ user.username }}</span>
			</div>

			<div class="divider"></div>

			<div class="tabs">
				<button class="tab" :class="{ active: activeTab === 'activity' }" @click="activeTab = 'activity'">Activity</button>
				<button class="tab" :class="{ active: activeTab === 'mutual_friends' }" @click="activeTab = 'mutual_friends'">
					{{ is_me ? 'Friends' : 'Mutual Friends' }}
					<span class="badge" v-if="displayFriends.length">{{ displayFriends.length }}</span>
				</button>
				<button class="tab" :class="{ active: activeTab === 'mutual_servers' }" @click="activeTab = 'mutual_servers'">
					{{ is_me ? 'Servers' : 'Mutual Servers' }}
					<span class="badge" v-if="displayServers.length">{{ displayServers.length }}</span>
				</button>
			</div>

			<div class="tab-content scrollable">
				<!-- Activity Tab -->
				<div v-show="activeTab === 'activity'" class="activity-section">
					<div v-if="!hasActivities || !user.activities" class="empty-state">
						<Icon icon="mdi:emoticon-sad-outline" class="empty-icon" />
						<p>No activity at the moment.</p>
					</div>
					<div class="activity-list" v-else>
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

				<!-- Mutual Friends Tab -->
				<div v-show="activeTab === 'mutual_friends'" class="mutual-section">
					<div class="empty-state" v-if="displayFriends.length === 0">
						<Icon icon="mdi:account-group" class="empty-icon" />
						<p>{{ is_me ? 'You have no friends.' : 'No mutual friends.' }}</p>
					</div>
					<div class="list" v-else>
						<div v-for="friend in displayFriends" :key="friend.id.toString()" class="list-item">
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
					<div class="empty-state" v-if="displayServers.length === 0">
						<Icon icon="mdi:server" class="empty-icon" />
						<p>{{ is_me ? 'You are not in any servers.' : 'No mutual servers.' }}</p>
					</div>
					<div class="list" v-else>
						<div v-for="server in displayServers" :key="server.id.toString()" class="list-item">
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

	.banner.is-me:hover .banner-edit-overlay {
		opacity: 1;
	}

	.banner-edit-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: rgba(0, 0, 0, 0.4);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		opacity: 0;
		transition: opacity 0.2s;
		cursor: pointer;
		color: white;
		font-weight: 600;
		gap: 8px;
	}

	.banner-edit-overlay .edit-icon {
		font-size: 32px;
	}

	.banner-edit-overlay .edit-icon.spin {
		animation: spin 1s linear infinite;
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

	.avatar-wrapper.is-me:hover .avatar-edit-overlay {
		opacity: 1;
	}

	.avatar-edit-overlay {
		position: absolute;
		top: 8px;
		left: 8px;
		right: 8px;
		bottom: 8px;
		border-radius: 50%;
		background-color: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
		transition: opacity 0.2s;
		cursor: pointer;
		color: white;
	}

	.avatar-edit-overlay .edit-icon {
		font-size: 32px;
	}

	.avatar-edit-overlay .edit-icon.spin {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		100% {
			transform: rotate(360deg);
		}
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
	}

	.name {
		font-size: 1.5rem;
		font-weight: 700;
		margin: 0 0 4px 0;
		color: var(--text);
		display: flex;
		align-items: center;
		gap: 8px;
		width: max-content;
	}

	.name.is-editable {
		cursor: pointer;
		transition: color 0.2s;
	}

	.name.is-editable:hover {
		color: #ffffff;
	}

	.name-edit-icon {
		font-size: 1.2rem;
		opacity: 0;
		transition: opacity 0.2s;
	}

	.name.is-editable:hover .name-edit-icon {
		opacity: 1;
	}

	.name-container {
		margin: 0 0 4px 0;
	}

	.name-input {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--text);
		background: var(--bg-dark);
		border: 1px solid var(--border);
		border-radius: 4px;
		padding: 0px 4px;
		font-family: inherit;
		outline: none;
		transition: border-color 0.2s;
		field-sizing: content;
		min-width: 50px;
	}

	.name-input:focus {
		border-color: var(--color);
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
		gap: 20px;
		background-color: var(--bg-dark);
		padding: 20px;
		border-radius: 12px;
	}

	.activity-icon-wrapper {
		width: 90px;
		height: 90px;
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
		flex: 1;
	}

	.text-truncate {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.activity-title {
		font-size: 0.7rem;
		font-weight: 800;
		text-transform: uppercase;
		color: var(--text-muted);
		margin-bottom: 8px;
		letter-spacing: 0.04em;
		line-height: 1;
	}

	.activity-name {
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--text);
		margin-bottom: 2px;
	}

	.activity-detail {
		font-size: 0.9rem;
		color: var(--text-muted);
	}

	.music-progress-container {
		margin-top: 8px;
		width: 100%;
		min-width: 200px;
	}

	.music-progress-bar {
		height: 6px;
		background-color: var(--bg-light);
		border-radius: 3px;
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
		color: var(--text-muted);
		margin-top: 4px;
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
