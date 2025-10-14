<script setup lang="ts">
	import { computed } from 'vue';
	import User from '@/components/User.vue';
	import Chat from '@/views/Chat.vue';
	import type { User as UserType } from '@/types';
	import AddFriend from '@/components/AddFriendButton.vue';
	import UserCard from '@/components/UserCard.vue';
	import { useDMStore } from '@/stores/dm';
	import { useRouter, useRoute } from 'vue-router';
	import FriendsButton from '@/components/FriendsButton.vue';

	const dmStore = useDMStore();
	const dms = dmStore.dms;

	const router = useRouter();
	const route = useRoute();

	const selectedUserId = computed(() => route.params.userId);

	function handleUserClick(user: UserType) {
		router.push({ name: 'user', params: { userId: user.id } });
	}
</script>

<template>
	<div class="container">
		<aside>
			<FriendsButton />

			<div v-if="dms" class="user-list">
				<template v-for="(user, index) in dms" :key="user.id">
					<User :user="user" @click="handleUserClick(user)" :class="{ selected: selectedUserId === user.id }" />
					<div v-if="index < dms.length - 1" class="user-separator"></div>
				</template>
			</div>

			<UserCard />
		</aside>
		<main>
			<router-view />
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
		background-color: #202225;
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
		background-color: #36393f;
		position: relative;
		height: 100%;
	}

	.selected {
		background-color: #535353;
	}
</style>
