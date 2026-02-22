<script setup lang="ts">
	import { ref, watch } from 'vue';
	import { Icon } from '@iconify/vue';
	import { searchUser } from '@/api/event';
	import type { User } from '@/types';
	import { useMeStore } from '@/stores/me';
	import { useFriendStore } from '@/stores/friend';
	import { type Message, MessageType, type Event, EventType } from '@/types';
	import { websocketService } from '@/services/websocket';

	const friendStore = useFriendStore();
	const meStore = useMeStore();
	const props = defineProps<{ isModalOpen: boolean }>();
	const emit = defineEmits<{ (event: 'update:isModalOpen', value: boolean): void }>();

	const searchQuery = ref('');
	const searchResults = ref<User[]>([]);
	const isLoading = ref(false);
	const hasSearched = ref(false);

	const fetchSearchResults = async () => {
		if (!searchQuery.value.trim()) {
			searchResults.value = [];
			return;
		}
		isLoading.value = true;
		hasSearched.value = true;
		try {
			const data = await searchUser(searchQuery.value);
			const filteredData = data.filter((user) => user.id !== meStore.me?.id);
			searchResults.value = filteredData;
		} catch (err) {
			console.error(err);
			searchResults.value = [];
		} finally {
			isLoading.value = false;
		}
	};

	let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
	watch(searchQuery, (newVal) => {
		if (!newVal) {
			searchResults.value = [];
			hasSearched.value = false;
			return;
		}
		if (debounceTimeout) clearTimeout(debounceTimeout);
		isLoading.value = true;
		debounceTimeout = setTimeout(() => {
			fetchSearchResults();
		}, 600);
	});

	const closeModal = () => {
		emit('update:isModalOpen', false);
		setTimeout(() => {
			searchQuery.value = '';
			searchResults.value = [];
			hasSearched.value = false;
		}, 200);
	};

	const getButtonStatus = (user: User) => {
		if (friendStore.isFriend(user.id)) return { class: 'btn-disabled', icon: 'mdi:account-check' };
		if (friendStore.isRequestSent(user.id)) return { class: 'btn-disabled', icon: 'mdi:check' };
		if (friendStore.isRequestReceived(user.id)) return { class: 'btn-primary', icon: 'mdi:account-arrow-left' };
		return { class: 'btn-primary', icon: 'mdi:account-plus' };
	};
</script>

<template>
	<transition name="fade">
		<div v-if="props.isModalOpen" class="modal-backdrop" @click="closeModal">
			<div class="modal-container" @click.stop>
				<header class="modal-header">
					<div class="title-group">
						<h2>Add Friend</h2>
						<span class="subtitle">You can add friends with their username.</span>
					</div>
					<button class="close-btn" @click="closeModal">
						<Icon icon="mdi:close" />
					</button>
				</header>

				<div class="search-section">
					<div class="input-wrapper">
						<input type="text" v-model="searchQuery" placeholder="Enter a username..." autofocus />
						<Icon icon="mdi:magnify" class="search-icon" />
					</div>
				</div>

				<div class="results-area">
					<div v-if="isLoading" class="state-message">
						<Icon icon="eos-icons:loading" class="spin" />
					</div>

					<div v-else-if="searchResults.length > 0" class="user-list">
						<div v-for="user in searchResults" :key="user.id.toString()" class="user-card">
							<div class="user-info">
								<img :src="user.avatar || '/default-user-icon.png'" alt="avatar" />
								<span class="username">{{ user.username }}</span>
							</div>

							<button
								class="action-btn"
								:class="getButtonStatus(user).class"
								@click="friendStore.sendFriendRequest(user)"
								:disabled="friendStore.isRequestSent(user.id) || friendStore.isFriend(user.id)"
							>
								<Icon :icon="getButtonStatus(user).icon" />
							</button>
						</div>
					</div>

					<div v-else-if="hasSearched && searchQuery" class="state-message error">
						<Icon icon="mdi:account-off-outline" />
						<span>No user found with that name.</span>
					</div>

					<div v-else class="state-message idle">
						<Icon icon="mdi:account-search-outline" />
						<span>Start typing to find friends.</span>
					</div>
				</div>
			</div>
		</div>
	</transition>
</template>
<style scoped>
	.fade-enter-active,
	.fade-leave-active {
		transition: opacity 0.2s ease;
	}
	.fade-enter-from,
	.fade-leave-to {
		opacity: 0;
	}

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
		background-color: var(--bg2);
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
		background-color: var(--bg2);
		border: 2px solid var(--bg2);
	}

	.user-info .username {
		color: var(--text);
		font-weight: 600;
		font-size: 1rem;
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
		background-color: var(--success);
		color: #fff;
	}
	.btn-primary:hover {
		background-color: var(--success-hover);
		transform: translateY(-1px);
	}

	.btn-disabled {
		background-color: var(--bg2);
		color: var(--text-muted);
		opacity: 0.8;
	}

	.btn-text {
		display: none;
	}
	@media (min-width: 400px) {
		.btn-text {
			display: block;
		}
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
