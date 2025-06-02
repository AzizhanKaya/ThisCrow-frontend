<script setup lang="ts">
	import { ref, watch } from 'vue';
	import { Icon } from '@iconify/vue';
	import { searchFriends, addFriend } from '@/api/state';
	import type { User } from '@/types';

	const props = defineProps<{
		isModalOpen: boolean;
	}>();

	const emit = defineEmits<{
		(event: 'update:isModalOpen', value: boolean): void;
	}>();

	const searchQuery = ref('');
	const searchResults = ref<User[] | null>(null);
	const NoUsersFound = ref(false);

	const fetchSearchResults = async () => {
		if (!searchQuery.value.trim()) {
			return;
		}

		try {
			const data = await searchFriends(searchQuery.value);
			NoUsersFound.value = data.length == 0;
			searchResults.value = data;
		} catch (err) {
			console.error('Error fetching users:', err);
		}
	};

	let debounceTimeout: ReturnType<typeof setTimeout> | null = null;

	watch(searchQuery, (newValue, oldValue) => {
		if (oldValue == null || oldValue === '') {
			fetchSearchResults();
			return;
		}

		if (debounceTimeout) clearTimeout(debounceTimeout);
		debounceTimeout = setTimeout(() => {
			fetchSearchResults();
		}, 1000);
	});

	const sendFriendRequest = async (userId: string) => {
		try {
			await addFriend(userId);
			console.info('Friend request sent to:', userId);
			searchResults.value = searchResults.value!.map((result) => (result.id === userId ? { ...result, is_friend: true } : result));
		} catch (err) {
			console.error('Failed to send friend request:', err);
		}
	};

	const closeModal = () => {
		emit('update:isModalOpen', false);
	};
</script>

<template>
	<div class="user-modal" @click.stop>
		<header class="modal-header">
			<h2>Add Friend</h2>
			<Icon icon="mdi:close" class="close-icon" @click="closeModal" />
		</header>
		<div class="modal-content">
			<input type="text" v-model="searchQuery" placeholder="Search user @" />
			<div class="results-container">
				<div v-for="user in searchResults" :key="user.id" class="user">
					<img :src="user.avatar || '/default-user-icon.png'" alt="" />
					<span>{{ user.username }}</span>
					<Icon icon="ic:outline-plus" class="add-icon" @click="sendFriendRequest(user.id)" />
				</div>

				<div v-if="NoUsersFound">
					<span>No Users Found :(</span>
				</div>
			</div>
		</div>
	</div>
</template>

<style scoped>
	.user-modal {
		position: absolute;
		background-color: #202225;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		border-radius: 8px;
		width: 30%;
		padding: 40px;
		min-width: 300px;
		border: 1px solid #2f3136;
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
	}

	header {
		margin-bottom: 20px;
	}

	.close-icon {
		cursor: pointer;
		font-size: 3rem;
		position: absolute;
		right: 10px;
		top: 10px;
		border-radius: 50%;
		padding: 10px;
	}
	.close-icon:hover {
		background-color: #2f3136;
	}

	input {
		width: 100%;
		padding: 10px;
		padding-left: 20px;
		border-radius: 4px;
		border: none;
		background-color: #303030;
		color: white;
		font-size: 16px;
		margin-bottom: 20px;
	}

	.results-container {
		max-height: 300px;
		overflow-y: auto;
		background-color: #16171a;
		border-radius: 10px;
		padding: 20px;
		height: 200px;
	}

	.user {
		display: flex;
		gap: 20px;
		align-items: center;
		border-radius: 4px;
		margin-bottom: 20px;
		height: 50px;
	}

	.user img {
		height: 100%;
		aspect-ratio: 1;
	}

	.add-icon {
		cursor: pointer;
		color: #cfcfcf;
		font-size: 2rem;
		transition: color 0.3s;
		margin-left: auto;
	}

	.add-icon:hover {
		color: #fff;
	}
</style>
