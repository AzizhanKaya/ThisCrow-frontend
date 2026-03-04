<script setup lang="ts">
	import { useFriendStore } from '@/stores/friend';
	import { Status, type User as UserType } from '@/types';
	import { useRouter } from 'vue-router';
	import { Icon } from '@iconify/vue';
	import { ref, computed, type ComputedRef } from 'vue';
	import { useDMStore } from '@/stores/dm';
	import ContextMenu from '@/components/ContextMenu.vue';
	import AddFriendButton from '@/components/Friends/AddFriendButton.vue';
	import User from '@/components/Friends/User.vue';

	const router = useRouter();
	const friendStore = useFriendStore();

	type FriendTab = 'all' | 'online' | 'pending';
	const activeTab = ref<FriendTab>('all');
	const searchQuery = ref('');

	const filteredFriends: ComputedRef<UserType[]> = computed(() => {
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

			<AddFriendButton />
		</div>

		<div v-if="activeTab === 'pending'" class="content">
			<template v-if="friendStore.incoming_requests.length === 0 && friendStore.outgoing_requests.length === 0">
				<div class="no-friends">No pending requests.</div>
			</template>
			<template v-else>
				<!-- Incoming Requests -->
				<div class="section" v-if="friendStore.incoming_requests.length > 0">
					<div class="section-header">Incoming — {{ friendStore.incoming_requests.length }}</div>
					<div class="friend-list">
						<User v-for="friend in friendStore.incoming_requests" :key="friend.id.toString()" :user="friend" request />
					</div>
				</div>

				<!-- Outgoing Requests -->
				<div class="section" v-if="friendStore.outgoing_requests.length > 0">
					<div class="section-header">Outgoing — {{ friendStore.outgoing_requests.length }}</div>
					<div class="friend-list">
						<User v-for="friend in friendStore.outgoing_requests" :key="friend.id.toString()" :user="friend" request_sent />
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
				<TransitionGroup name="list" tag="div" class="friend-list">
					<User v-for="friend in filteredFriends" :key="friend.id.toString()" :user="friend" friend />
				</TransitionGroup>
			</template>
		</div>
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

	.tab.active {
		background-color: var(--bg-light);
		color: var(--text);
	}

	.tab:hover {
		background-color: var(--bg-lighter);
		color: var(--text);
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
		min-width: 150px;
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

	.section {
		padding-bottom: 16px;
	}

	.section-header {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		margin-bottom: 8px;
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
		padding: 8px 12px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		transition: background-color 0.2s;
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
		margin-left: 0px;
	}
	.name:hover {
		text-decoration: underline;
		cursor: pointer;
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

	.list-enter-active,
	.list-leave-active {
		transition: all 0.1s ease-in;
	}

	.list-enter-from,
	.list-leave-to {
		opacity: 0;
		transform: translateY(20px);
	}
</style>
