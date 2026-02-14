<script setup lang="ts">
	import { ref } from 'vue';
	import User from '@/components/User.vue';
	import Chat from '@/views/Chat.vue';
	import type { User as UserType } from '@/types';
	import AddFriend from '@/components/AddFriendButton.vue';
	import UserCard from '@/components/UserCard.vue';
	import { useFriendStore } from '@/stores/friend';

	const friendStore = useFriendStore();

	const friends = friendStore.friends;

	const selectedUser = ref<UserType | undefined>(undefined);

	function handleUserClick(user: UserType) {
		selectedUser.value = user;
	}
</script>

<template>
	<div class="container">
		<aside>
			<AddFriend />

			<div v-if="friends" class="user-list">
				<template v-for="(user, index) in friends" :key="user.id.toString()">
					<User :user="user" @click="handleUserClick(user)" :class="{ selected: selectedUser?.id === user.id }" />
					<div v-if="index < friends.length - 1" class="user-separator"></div>
				</template>
			</div>

			<UserCard />
		</aside>
		<main>
			<Chat v-if="selectedUser" :key="selectedUser.id.toString()" :selectedUser="selectedUser" />
		</main>
	</div>
</template>

<style scoped>
	.container {
		display: grid;
		grid-template-columns: clamp(200px, 20%, 300px) 1fr;
		height: 100%;
		position: relative;
	}

	aside {
		background-color: var(--bg-dark);
		border: 1px solid #303030;
		border-top-left-radius: 20px;
		position: relative;
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
		background-color: var(--bg);
		position: relative;
		height: 100%;
	}

	.selected {
		background-color: #535353;
	}
</style>
