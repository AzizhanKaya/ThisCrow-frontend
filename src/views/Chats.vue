<script setup lang="ts">
	import { ref, watch } from 'vue';
	import { getFriendList } from '@/api/state';
	import User from '@/components/User.vue';
	import Chat from '@/views/Chat.vue';
	import type { User as UserType } from '@/types';
	import { Icon } from '@iconify/vue';
	import AddFriend from '@/components/AddFriendButton.vue';

	const selectedUser = ref<UserType | undefined>(undefined);

	function handleUserClick(user: UserType) {
		selectedUser.value = user;
	}

	const { friends, error, isFetching } = getFriendList();

	watch(
		isFetching,
		(newVal) => {
			if (!newVal) {
				if (error.value) {
					console.error('get friends error:', error.value);
				}

				if (friends.value && friends.value.length > 0) {
					selectedUser.value = friends.value[0];
				}
			}
		},
		{ once: true }
	);
</script>

<template>
	<div class="container">
		<aside>
			<AddFriend />
			<div v-if="isFetching" class="loading-state">
				<Icon icon="line-md:loading-loop" />
			</div>
			<div v-else-if="friends" class="user-list">
				<template v-for="(user, index) in friends" :key="user.id">
					<User :user="user" @click="handleUserClick(user)" :class="{ selected: selectedUser?.id === user.id }" />
					<div v-if="index < friends.length - 1" class="user-separator"></div>
				</template>
			</div>
		</aside>
		<main>
			<Chat v-if="selectedUser" :key="selectedUser.id" :selectedUser="selectedUser" />
		</main>
	</div>
</template>

<style scoped>
	.container {
		display: grid;
		grid-template-columns: clamp(200px, 20%, 300px) 1fr;
		height: 100vh;
		position: relative;
	}

	aside {
		background-color: #202225;
		border: 1px solid #303030;
		border-top-left-radius: 20px;
	}

	.user-list {
		display: flex;
		flex-direction: column;
		padding: 10px;
		padding-top: 20px;
		gap: 5px;
	}

	.user-separator {
		height: 1px;
		background-color: #303030;
		margin-left: 50px;
	}

	main {
		background-color: #36393f;
		position: relative;
		height: 100vh;
	}

	.selected {
		background-color: #535353;
	}
</style>
