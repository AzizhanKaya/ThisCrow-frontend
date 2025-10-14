<script setup lang="ts">
	import { useFriendStore } from '@/stores/friends';
	import type { User } from '@/types';
	import { useRouter } from 'vue-router';

	const router = useRouter();

	function handleMessage(friend: User) {
		router.push('/user/' + friend.id);
	}

	const friendStore = useFriendStore();
</script>

<template>
	<div class="friend-view">
		<h2>Friends</h2>

		<div v-if="!friendStore.friends.length" class="no-friends">No friends yet.</div>

		<div v-else class="friend-list">
			<div v-for="friend in friendStore.friends" :key="friend.id" class="friend-card">
				<div class="friend-info">
					<img :src="friend.avatar || '/default-avatar.png'" alt="avatar" class="avatar" />
					<div class="friend-text">
						<span class="username">{{ friend.username }}</span>
						<span class="status">{{ friend.state || 'Offline' }}</span>
					</div>
				</div>
				<button class="message-btn" @click="handleMessage(friend)">Message</button>
			</div>
		</div>
	</div>
</template>

<style scoped>
	.friend-view {
		color: #fff;
		height: 100%;
		padding: 24px;
		display: flex;
		flex-direction: column;
	}

	.friend-view h2 {
		font-size: 22px;
		font-weight: 600;
		margin-bottom: 20px;
	}

	.no-friends {
		color: #999;
		text-align: center;
		margin-top: 60px;
	}

	.friend-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.friend-card {
		background-color: #2f3136;
		border-radius: 8px;
		padding: 10px 14px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		transition: background-color 0.2s;
	}

	.friend-card:hover {
		background-color: #474a50;
		cursor: pointer;
	}

	.friend-info {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.avatar {
		width: 40px;
		height: 40px;
		border-radius: 50%;
	}

	.friend-text {
		display: flex;
		flex-direction: column;
	}

	.username {
		font-weight: 500;
		font-size: 16px;
	}

	.status {
		color: #bbb;
		font-size: 13px;
	}

	.message-btn {
		background-color: #5865f2;
		color: white;
		border: none;
		border-radius: 5px;
		padding: 6px 10px;
		cursor: pointer;
		font-size: 14px;
	}

	.message-btn:hover {
		background-color: #4752c4;
	}
</style>
