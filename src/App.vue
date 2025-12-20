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
			userStore.user = null;
			router.push('/login');
		}
		loading.value = false;
	});
</script>

<template>
	<router-view v-slot="{ Component }">
		<Transition name="fade" mode="out-in">
			<div v-if="loading" class="splash-screen">
				<img src="/default-server-icon.png" alt="" />
			</div>
			<component v-else :is="Component" :key="route.meta.layout" />
		</Transition>
	</router-view>
</template>

<style>
	html,
	body {
		margin: 0;
		padding: 0;
		height: 100%;
		background-color: var(--bg-dark);
	}

	:root {
		--bg-dark: hsl(216, 7%, 14%);
		--bg: hsl(216, 7%, 23%);
		--bg-light: hsl(216, 7%, 28%);
		--bg2: hsl(0, 0%, 19%);

		--text: hsl(0 0% 95%);
		--text-muted: hsl(0 0% 75%);

		--border: hsl(0, 0%, 19%);
		--border-muted: hsl(0, 0%, 15%);

		--color-dark: hsl(261, 68%, 40%);
		--color: hsl(261, 68%, 45%);
		--color-light: hsl(261, 68%, 50%);
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
		font-family: Arial;
		color: var(--text);
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
	}

	.splash-screen img {
		width: 200px;
		object-fit: contain;
	}
</style>
