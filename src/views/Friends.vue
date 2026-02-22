<script setup lang="ts">
	import { useFriendStore } from '@/stores/friend';
	import { Status, type User } from '@/types';
	import { useRouter } from 'vue-router';
	import { Icon } from '@iconify/vue';
	import { ref, computed, type ComputedRef } from 'vue';
	import AddFriend from '@/modals/AddFriend.vue';
	import { useDMStore } from '@/stores/dm';

	const router = useRouter();
	const friendStore = useFriendStore();

	type FriendTab = 'all' | 'online' | 'pending';
	const activeTab = ref<FriendTab>('all');
	const searchQuery = ref('');
	const isModalOpen = ref(false);

	const filteredFriends: ComputedRef<User[]> = computed(() => {
		let friends = Array.from(friendStore.friends.values());

		if (activeTab.value === 'online') {
			friends = friends.filter((f) => f.status && f.status !== 'Offline');
		}

		if (searchQuery.value) {
			const query = searchQuery.value.toLowerCase();
			friends = friends.filter((f) => f.username.toLowerCase().includes(query) || f.name.toLowerCase().includes(query));
		}

		return friends.sort((a, b) => {
			const priorityA = a.status === 'Offline' ? 1 : 0;
			const priorityB = b.status === 'Offline' ? 1 : 0;

			if (priorityA !== priorityB) {
				return priorityA - priorityB;
			}

			return a.username.localeCompare(b.username);
		});
	});

	async function handleMessage(friend: User) {
		const dmStore = useDMStore();
		await dmStore.ensureUser(friend.id);
		router.push({ name: 'user', params: { userId: friend.id.toString() } });
	}

	function handleAddFriend() {
		isModalOpen.value = true;
	}

	function isOnline(friend: User) {
		return friend.status && friend.status !== 'Offline';
	}

	function getState(user: User): string {
		switch (user.status) {
			case Status.Online:
				return 'online';
			case Status.Idle:
				return 'idle';
			case Status.Dnd:
				return 'dnd';
			case Status.Offline:
				return 'offline';
		}
	}
</script>

<template>
	<div class="friend-view">
		<!-- Header Tabs -->
		<div class="header">
			<div class="tabs">
				<button :class="['tab', { active: activeTab === 'all' }]" @click="activeTab = 'all'">
					<Icon icon="mdi:account-multiple" />
					Friends
				</button>
				<button :class="['tab', { active: activeTab === 'online' }]" @click="activeTab = 'online'">
					<Icon icon="mdi:account-online" />
					Online
				</button>
				<button :class="['tab', { active: activeTab === 'pending' }]" @click="activeTab = 'pending'">
					<Icon icon="mdi:account-plus" />
					Pending
					<span v-if="friendStore.incoming_requests.length > 0" class="badge">{{ friendStore.incoming_requests.length }}</span>
				</button>
			</div>

			<!-- Search Bar -->
			<div class="search-container">
				<Icon icon="mdi:magnify" class="search-icon" />
				<input v-model="searchQuery" type="text" placeholder="Search" class="search-input" />
			</div>

			<button class="add-friend-btn" @click="handleAddFriend">
				<Icon icon="mdi:account-plus" />
				Add Friend
			</button>
		</div>

		<div v-if="activeTab === 'pending'" class="content">
			<template v-if="friendStore.incoming_requests.length === 0 && friendStore.outgoing_requests.length === 0">
				<div class="no-friends">No pending requests.</div>
			</template>
			<template v-else>
				<!-- Incoming Requests -->
				<div v-if="friendStore.incoming_requests.length > 0">
					<div class="section-header">Incoming — {{ friendStore.incoming_requests.length }}</div>
					<div class="friend-list">
						<div v-for="friend in friendStore.incoming_requests" :key="friend.id.toString()" class="friend-card">
							<div class="friend-info">
								<div class="avatar-container">
									<img :src="friend.avatar || '/default-user-icon.png'" alt="avatar" class="avatar loaded" />
									<div :class="['state', getState(friend)]"></div>
								</div>
								<div class="friend-text">
									<div>
										<span class="name">{{ friend.name }}</span>
										<span class="username">@{{ friend.username }}</span>
									</div>
									<span class="status">{{ friend.status }}</span>
								</div>
							</div>
							<div class="action-buttons">
								<button class="icon-btn success" @click="friendStore.acceptFriendRequest(friend)" title="Accept">
									<Icon icon="mdi:check" />
								</button>
								<button class="icon-btn danger" @click="friendStore.removeFriend(friend)" title="Reject">
									<Icon icon="mdi:close" />
								</button>
							</div>
						</div>
					</div>
				</div>

				<!-- Outgoing Requests -->
				<div v-if="friendStore.outgoing_requests.length > 0" :style="{ marginTop: '24px' }">
					<div class="section-header">Outgoing — {{ friendStore.outgoing_requests.length }}</div>
					<div class="friend-list">
						<div v-for="friend in friendStore.outgoing_requests" :key="friend.id.toString()" class="friend-card">
							<div class="friend-info">
								<div class="avatar-container">
									<img :src="friend.avatar || '/default-user-icon.png'" alt="avatar" class="avatar loaded" />
								</div>
								<div class="friend-text">
									<span class="name">{{ friend.name }}</span>
									<span class="username">@{{ friend.username }}</span>
								</div>
							</div>
							<div class="action-buttons">
								<button class="icon-btn danger" @click="friendStore.removeFriend(friend)" title="Cancel Request">
									<Icon icon="mdi:close" />
								</button>
							</div>
						</div>
					</div>
				</div>
			</template>
		</div>

		<div v-else class="content">
			<div v-if="filteredFriends.length === 0" class="no-friends">
				<span v-if="activeTab === 'online'">No friends online.</span>
				<span v-else>No friends found.</span>
			</div>
			<template v-else>
				<div class="section-header">{{ activeTab === 'online' ? 'Online' : 'All Friends' }} — {{ filteredFriends.length }}</div>
				<div class="friend-list">
					<div v-for="friend in filteredFriends" :key="friend.id.toString()" class="friend-card">
						<div class="friend-info">
							<div class="avatar-container">
								<img :src="friend.avatar || '/default-user-icon.png'" alt="avatar" class="avatar loaded" />
								<div :class="['state', getState(friend)]"></div>
							</div>
							<div class="friend-text">
								<div>
									<span class="name">{{ friend.name }}</span>
									<span class="username">@{{ friend.username }}</span>
								</div>
								<div class="status-container">
									<span v-if="friend.status" class="status">{{ friend.status }}</span>
								</div>
							</div>
						</div>
						<div class="action-buttons">
							<button class="icon-btn" @click="handleMessage(friend)" title="Send message">
								<Icon icon="mdi:message" />
							</button>
							<button class="icon-btn danger" title="Unfriend" @click="friendStore.removeFriend(friend)">
								<Icon icon="mdi:user-remove" />
							</button>
						</div>
					</div>
				</div>
			</template>
		</div>

		<AddFriend :isModalOpen="isModalOpen" @update:isModalOpen="isModalOpen = $event" />
	</div>
</template>

<style scoped>
	.friend-view {
		color: var(--text);
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 18px;
		border-bottom: 1px solid var(--border-muted);
		gap: 20px;
	}

	.tabs {
		display: flex;
		gap: 8px;
	}

	.tab {
		background: none;
		border: none;
		color: var(--text-muted);
		font-size: 15px;
		font-weight: 500;
		cursor: pointer;
		padding: 8px 12px;
		border-radius: 20px;
		display: flex;
		align-items: center;
		gap: 4px;
		transition: all 0.2s;
	}

	.tab:hover {
		background-color: var(--bg-light);
		color: var(--text);
	}

	.tab.active {
		background-color: var(--bg-light);
		color: var(--text);
	}

	.add-friend-btn {
		background-color: var(--color);
		color: white;
		border: none;
		border-radius: 4px;
		padding: 8px 16px;
		cursor: pointer;
		font-size: 15px;
		font-weight: 500;
		transition: background-color 0.2s;
		align-items: center;
		display: flex;
		gap: 6px;
	}

	.add-friend-btn:hover {
		background-color: var(--color-light);
	}

	.search-container {
		position: relative;
		flex: 1;
	}

	.search-icon {
		position: absolute;
		left: 10px;
		top: 50%;
		transform: translateY(-50%);
		color: var(--text-muted);
		font-size: 18px;
		pointer-events: none;
	}

	.search-input {
		width: 100%;
		background-color: var(--bg-dark);
		border: none;
		border-radius: 4px;
		padding: 8px 12px 8px 36px;
		color: var(--text-muted);
		font-size: 14px;
		outline: none;
	}

	.search-input::placeholder {
		color: var(--text-muted);
	}

	.content {
		flex: 1;
		overflow-y: auto;
		padding: 16px 24px;
	}

	.section-header {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		margin-bottom: 12px;
		letter-spacing: 0.5px;
	}

	.no-friends {
		color: var(--text-muted);
		text-align: center;
		padding: 20px 20px;
		font-size: 14px;
	}

	.friend-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.friend-card {
		border-radius: 8px;
		padding: 12px 16px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		transition: background-color 0.2s;
		border-top: 1px solid var(--border-muted);
	}

	.friend-card:first-child {
		border-top: none;
	}

	.friend-card:hover {
		background-color: var(--bg-dark);
	}

	.friend-info {
		display: flex;
		align-items: center;
		gap: 12px;
		flex: 1;
	}

	.avatar-container {
		position: relative;
	}

	.avatar {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background-color: var(--bg-dark);
		transition: opacity 0.1s ease-in;
		opacity: 0;
	}

	.avatar.loaded {
		opacity: 1;
	}

	.state {
		height: 12px;
		width: 12px;
		border-radius: 50%;
		position: absolute;
		z-index: 10;
		border: 2px #333 solid;
		left: 29px;
		bottom: 5px;
		flex-shrink: 0;
	}

	.state.online {
		background-color: #43b581;
	}
	.state.dnd {
		background-color: #f04747;
	}
	.state.idle {
		background-color: #e2e446;
	}
	.state.offline {
		background-color: #72767d;
	}

	.friend-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.name {
		font-weight: 500;
		font-size: 1rem;
		color: var(--text);
	}
	.username {
		font-weight: 500;
		font-size: 0.8rem;
		color: var(--text-muted);
		margin-left: 4px;
	}

	.status-container {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.status {
		color: #b9bbbe;
		font-size: 13px;
	}

	.action-buttons {
		display: flex;
		gap: 8px;
		opacity: 0;
		transition: opacity 0.2s;
	}

	.friend-card:hover .action-buttons {
		opacity: 1;
	}

	.icon-btn {
		background-color: var(--bg-dark);
		color: var(--text-muted);
		border: none;
		border-radius: 50%;
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		font-size: 20px;
		transition: all 0.2s;
	}

	.icon-btn:hover {
		background-color: #3a3d44;
		color: #dcddde;
	}

	.icon-btn.success:hover {
		background-color: var(--success);
		color: white;
	}

	.icon-btn.danger:hover {
		background-color: var(--error);
		color: white;
	}

	.badge {
		background-color: var(--error);
		color: white;
		font-size: 11px;
		padding: 2px 6px;
		border-radius: 10px;
		margin-left: 4px;
		font-weight: 700;
	}
</style>
