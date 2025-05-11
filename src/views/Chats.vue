<script setup lang="ts">
	import { ref } from 'vue';
	import { getFriendList } from '@/api/state';
	import User from '@/components/User.vue';

	const { friends, error, isFetching } = getFriendList();
</script>

<template>
	<div class="container">
		<aside>
			<div v-if="isFetching" class="loading-state">Yükleniyor...</div>
			<div v-else-if="error" class="error-state">Bir hata oluştu: {{ error }}</div>
			<div v-else-if="friends" class="user-list">
				<User v-for="user in friends" :key="user.id" :user="user" />
			</div>
		</aside>
		<main></main>
	</div>
</template>

<style scoped>
	.container {
		display: grid;
		grid-template-columns: clamp(200px, 20%, 300px) 1fr;
		height: 100vh;
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

	main {
		background-color: #36393f;
	}
</style>
