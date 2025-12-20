<script setup lang="ts">
	import { useFriendStore } from '@/stores/friends';
	import { State, type User } from '@/types';
	import { useRouter } from 'vue-router';
	import { Icon } from '@iconify/vue';
	import { ref, computed, type ComputedRef } from 'vue';
	import AddFriend from '@/modals/AddFriend.vue';

	const router = useRouter();
	const friendStore = useFriendStore();

	const activeTab = ref('all');
	const searchQuery = ref('');
	const isModalOpen = ref(false);

	const onlineFriends = computed(() => {
		return friendStore.friends.filter((friend) => friend.state && friend.state !== 'Offline');
	});

	const filteredFriends: ComputedRef<User[]> = computed(() => {
		let friends = activeTab.value === 'online' ? onlineFriends.value : friendStore.friends;
		if (searchQuery.value) {
			friends = friends.filter((friend) => friend.username.toLowerCase().includes(searchQuery.value.toLowerCase()));
		}
		return friends;
	});

	function handleMessage(friend: User) {
		router.push('/user/' + friend.id);
	}

	function handleAddFriend() {
		isModalOpen.value = true;
	}

	function isOnline(friend: User) {
		return friend.state && friend.state !== 'Offline';
	}

	function getState(user: User): string {
		switch (user.state) {
			case State.Online:
				return 'online';
			case State.Offline:
				return 'offline';
			case State.Dnd:
				return 'dnd';
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
				</button>
			</div>

			<!-- Search Bar -->
			<div class="search-container">
				<Icon icon="mdi:magnify" class="search-icon" />
				<input v-model="searchQuery" type="text" placeholder="Ara" class="search-input" />
			</div>

			<button class="add-friend-btn" @click="handleAddFriend">
				<Icon icon="mdi:account-plus" />
				Add Friend
			</button>
		</div>

		<div v-if="!friendStore.friends.length" class="no-friends">No friends yet.</div>

		<div v-else class="content">
			<!-- Online Counter -->
			<div class="section-header">Online — {{ activeTab === 'online' ? onlineFriends.length : filteredFriends.filter((f) => isOnline(f)).length }}</div>

			<!-- Friend List -->
			<div class="friend-list">
				<div v-for="friend in filteredFriends" :key="friend.id" class="friend-card">
					<div class="friend-info">
						<div class="avatar-container">
							<img
								:src="friend.avatar || '/default-user-icon.png'"
								alt="avatar"
								class="avatar"
								@load="($event.target as HTMLImageElement).classList.add('loaded')"
							/>
							<div :class="['state', getState(friend)]"></div>
						</div>
						<div class="friend-text">
							<span class="username">{{ friend.username }}</span>
							<div class="status-container">
								<span v-if="friend.state" class="status">{{ friend.state }}</span>
							</div>
						</div>
					</div>
					<div class="action-buttons">
						<button class="icon-btn" @click="handleMessage(friend)" title="Send message">
							<Icon icon="mdi:message" />
						</button>
						<button class="icon-btn" title="More">
							<Icon icon="mdi:dots-vertical" />
						</button>
					</div>
				</div>
			</div>
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
		aspect-ratio: 1;
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
		background-color: red;
	}

	.state.offline {
		background-color: gray;
	}

	.friend-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.username {
		font-weight: 500;
		font-size: 16px;
		color: #dcddde;
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
</style>
