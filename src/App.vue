<script setup lang="ts">
	import { onMounted, ref } from 'vue';
	import { useUserStore } from '@/stores/user';
	import { useRouter, useRoute } from 'vue-router';
	import { initApp } from '@/init';

	const userStore = useUserStore();

	const router = useRouter();
	const route = useRoute();
	const loading = ref(true);

	onMounted(async () => {
		await userStore.initUser();

		if (userStore.isLoggedIn) {
			await initApp();
		} else {
			router.push('/login');
		}
		loading.value = false;
	});
</script>

<template>
	<router-view v-slot="{ Component }">
		<transition name="fade" mode="out-in">
			<div v-if="loading" class="splash-screen">
				<img src="/default-server-icon.png" alt="" />
			</div>
			<component v-else :is="Component" :key="route.meta.layout" />
		</transition>
	</router-view>
</template>

<style>
	html,
	body {
		margin: 0;
		padding: 0;
		height: 100%;
		background-color: #202225;
	}

	* {
		margin: 0;
		padding: 0;
		box-sizing: border-box;
	}

	#app {
		position: absolute;
		height: 100%;
		width: 100%;
		overflow: hidden;
		font-family: Arial, Helvetica, sans-serif;
		color: white;
	}
</style>

<style scoped>
	.fade-enter-active,
	.fade-leave-active {
		transition: opacity 0.3s ease-out;
	}
	.fade-enter-from,
	.fade-leave-to {
		opacity: 0;
	}

	.splash-screen {
		height: 100vh;
		display: flex;
		justify-content: center;
		align-items: center;
		color: white;
	}

	.splash-screen img {
		width: 200px;
		object-fit: contain;
	}
</style>
