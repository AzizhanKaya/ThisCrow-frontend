<script setup lang="ts">
	import { ref, computed, watch } from 'vue';
	import { Icon } from '@iconify/vue';
	import { useRouter } from 'vue-router';
	import { useModalStore } from '@/stores/modal';
	import { useMeStore } from '@/stores/me';
	import { useFriendStore } from '@/stores/friend';
	import { useDMStore } from '@/stores/dm';
	import { searchUser } from '@/api/info';
	import type { id, User } from '@/types';

	const modalStore = useModalStore();
	const meStore = useMeStore();
	const friendStore = useFriendStore();
	const dmStore = useDMStore();
	const router = useRouter();

	const searchQuery = ref('');
	const networkResults = ref<User[]>([]);
	const isLoading = ref(false);
	const hasSearched = ref(false);

	const allLocalUsers = computed(() => {
		const users = new Map<string, User>();
		for (const friend of friendStore.friends.values()) {
			users.set(friend.id.toString(), friend);
		}
		for (const user of dmStore.dms) {
			users.set(user.id.toString(), user);
		}
		return Array.from(users.values());
	});

	const displayedResults = computed(() => {
		let localResults = allLocalUsers.value;

		if (searchQuery.value.trim()) {
			const query = searchQuery.value.toLowerCase();
			localResults = localResults.filter(
				(user) => user.username.toLowerCase().includes(query) || user.name.toLowerCase().includes(query)
			);
		}

		const combined = new Map<id, User>();
		for (const user of localResults) {
			combined.set(user.id, user);
		}
		for (const user of networkResults.value) {
			combined.set(user.id, user);
		}
		return Array.from(combined.values()).sort((a, b) => a.username.localeCompare(b.username));
	});

	const fetchSearchResults = async () => {
		if (!searchQuery.value.trim()) {
			networkResults.value = [];
			return;
		}
		isLoading.value = true;
		hasSearched.value = true;
		try {
			const data = await searchUser(searchQuery.value);
			const filteredData = data.filter((user) => user.id !== meStore.me?.id);
			networkResults.value = filteredData;
		} catch (err) {
			console.error(err);
			networkResults.value = [];
		} finally {
			isLoading.value = false;
		}
	};

	let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
	watch(searchQuery, (newVal) => {
		if (!newVal) {
			networkResults.value = [];
			hasSearched.value = false;
			return;
		}
		if (debounceTimeout) clearTimeout(debounceTimeout);
		isLoading.value = true;
		debounceTimeout = setTimeout(() => {
			fetchSearchResults();
		}, 600);
	});

	const handleMessage = async (user: User) => {
		modalStore.closeModal();
		await dmStore.ensureUser(user.id);
		router.push({ name: 'user', params: { userId: user.id.toString() } });
	};
</script>

<template>
	<div class="modal-backdrop" @click="modalStore.closeModal">
		<div class="modal-container" @click.stop>
			<header class="modal-header">
				<div class="title-group">
					<h2>Direct Message</h2>
					<span class="subtitle">Search for a user to start a direct message.</span>
				</div>
				<button class="close-btn" @click="modalStore.closeModal">
					<Icon icon="mdi:close" />
				</button>
			</header>

			<div class="search-section">
				<div class="input-wrapper">
					<input type="text" v-model="searchQuery" placeholder="Type a username..." autofocus />
					<Icon icon="mdi:magnify" class="search-icon" />
				</div>
			</div>

			<div class="results-area">
				<div v-if="isLoading && displayedResults.length === 0" class="state-message">
					<Icon icon="eos-icons:loading" class="spin" />
				</div>

				<div v-else-if="displayedResults.length > 0" class="user-list">
					<div v-for="user in displayedResults" :key="user.id.toString()" class="user-card" @click="handleMessage(user)">
						<div class="user-info">
							<img :src="user.avatar || '/default-avatar.png'" alt="avatar" />
							<div class="user-text">
								<span class="name">{{ user.name }}</span>
								<span class="username">@{{ user.username }}</span>
							</div>
						</div>

						<button class="action-btn btn-primary" @click.stop="handleMessage(user)">
							<Icon icon="mdi:message-text" />
						</button>
					</div>
				</div>

				<div v-else-if="searchQuery" class="state-message error">
					<Icon icon="mdi:account-off-outline" />
					<span>No user found with that name.</span>
				</div>

				<div v-else class="state-message idle">
					<Icon icon="mdi:account-group" />
					<span>No users found to message.</span>
				</div>
			</div>
		</div>
	</div>
</template>

<style scoped>
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		background-color: var(--overlay);
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.modal-container {
		background-color: var(--bg);
		width: 460px;
		max-width: 90%;
		border-radius: 12px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
		overflow: hidden;
		border: 1px solid var(--border);
		display: flex;
		flex-direction: column;
	}

	.modal-header {
		padding: 24px 24px 10px;
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
	}

	.modal-header h2 {
		margin: 0;
		font-size: 1.3rem;
		color: var(--text);
		font-weight: 700;
		letter-spacing: 0.5px;
		margin-bottom: 6px;
	}

	.subtitle {
		color: var(--text-muted);
		font-size: 0.9rem;
	}

	.close-btn {
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		font-size: 1.5rem;
		transition: color 0.2s;
		padding: 0;
		display: flex;
		align-items: center;
	}
	.close-btn:hover {
		color: var(--text);
	}

	.search-section {
		padding: 10px 24px 20px;
	}

	.input-wrapper {
		position: relative;
		background-color: var(--bg-dark);
		border: 1px solid var(--border-muted);
		border-radius: 8px;
		padding: 0 14px;
		display: flex;
		align-items: center;
		transition: all 0.2s;
	}

	.input-wrapper:focus-within {
		border-color: var(--color);
		box-shadow: 0 0 0 2px rgba(114, 137, 218, 0.1);
	}

	.input-wrapper input {
		width: 100%;
		padding: 14px 0;
		background: transparent;
		border: none;
		color: var(--text);
		font-size: 16px;
		outline: none;
	}

	.search-icon {
		color: var(--text-muted);
		font-size: 1.4rem;
		margin-left: 8px;
	}

	.results-area {
		background-color: var(--bg-dark);
		min-height: 200px;
		max-height: 350px;
		overflow-y: auto;
		padding: 16px 0;
		border-top: 1px solid var(--border);
	}

	.results-area::-webkit-scrollbar {
		width: 8px;
		background-color: var(--bg-dark);
	}
	.results-area::-webkit-scrollbar-thumb {
		background-color: var(--bg-dark);
		border-radius: 4px;
	}

	.user-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 24px;
		transition: background-color 0.2s;
		cursor: pointer;
	}

	.user-card:hover {
		background-color: var(--bg-light);
	}

	.user-info {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.user-info img {
		width: 42px;
		height: 42px;
		border-radius: 50%;
		object-fit: cover;
		background-color: var(--bg-dark);
		border: 2px solid var(--bg-dark);
	}

	.user-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.user-text .name {
		color: var(--text);
		font-weight: 600;
		font-size: 1rem;
	}

	.user-text .username {
		color: var(--text-muted);
		font-size: 0.8rem;
		font-weight: 500;
	}

	.action-btn {
		padding: 8px;
		border-radius: 6px;
		border: none;
		font-size: 0.9rem;
		font-weight: 500;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 6px;
		transition: all 0.2s;
	}

	.btn-primary {
		background-color: var(--color);
		color: #fff;
	}
	.btn-primary:hover {
		filter: brightness(1.1);
		transform: translateY(-1px);
	}

	.state-message {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 160px;
		color: var(--text-muted);
		text-align: center;
		padding: 0 20px;
	}

	.state-message svg {
		font-size: 3rem;
		margin-bottom: 12px;
		opacity: 0.4;
		color: var(--text-muted);
	}

	.spin {
		animation: spin 1s linear infinite;
		color: var(--color);
		opacity: 1 !important;
	}

	@keyframes spin {
		100% {
			transform: rotate(360deg);
		}
	}
</style>
