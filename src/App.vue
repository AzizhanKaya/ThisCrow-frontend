<script setup lang="ts">
	import { onMounted, ref } from 'vue';
	import { useMeStore } from '@/stores/me';
	import { useRouter, useRoute } from 'vue-router';
	import { initApp } from '@/init';
	import { websocketService } from '@/services/websocket';
	import { getMe } from '@/api/state';
	import Header from './components/Header.vue';
	import Modals from './components/Modals.vue';

	const isTauri = !!(window as any).__TAURI_INTERNALS__;

	const meStore = useMeStore();
	const router = useRouter();
	const route = useRoute();

	const loading = ref(true);

	websocketService.onConnectionStateChange(async (state) => {
		if (state === 'CLOSED') {
			loading.value = true;
		} else if (state === 'CONNECTING') {
			loading.value = true;
			try {
				await initApp();
			} catch (error) {
				console.error('initApp hatası:', error);
				meStore.logOut();
				websocketService.disconnect();
				router.push('/login');
			}
			loading.value = false;
		}
	});

	const handleBeforeUnload = () => {
		websocketService.disconnect();
	};

	onMounted(async () => {
		if (isTauri) {
			document.documentElement.classList.add('tauri');
		}

		window.addEventListener('beforeunload', handleBeforeUnload);

		try {
			loading.value = true;
			await getMe();
			websocketService.connect();
		} catch (error) {
			console.error(error);
			meStore.logOut();
			router.push('/login');
			loading.value = false;
		}
	});
</script>

<template>
	<Header></Header>
	<router-view v-slot="{ Component }">
		<Transition name="fade" mode="out-in">
			<div v-if="loading" class="splash-screen">
				<img src="/default-server-icon.png" alt="" />
			</div>
			<component v-else :is="Component" :key="route.meta.layout" />
		</Transition>
	</router-view>
	<Modals />
</template>

<style>
	html,
	body {
		margin: 0;
		padding: 0;
		height: 100%;
		overflow: hidden;
		background-color: var(--bg-dark);
	}

	.tauri body,
	html {
		background-color: transparent;
	}

	@font-face {
		font-family: 'gg sans';
		src: url('/fonts/gg sans.woff') format('woff');
		font-weight: normal;
		font-style: normal;
	}

	:root {
		--bg-darker: hsl(216, 7%, 10%);
		--bg-dark: hsl(216, 7%, 14%);
		--bg: hsl(216, 7%, 23%);
		--bg-light: hsl(216, 7%, 28%);
		--bg-lighter: hsl(216, 7%, 35%);

		--text: hsl(0 0% 95%);
		--text-muted: hsl(0 0% 75%);
		--text-subtle: hsl(216, 7%, 60%);

		--border: hsl(0, 0%, 19%);
		--border-muted: hsl(0, 0%, 15%);

		--color-dark: hsl(261, 68%, 40%);
		--color: hsl(261, 68%, 45%);
		--color-light: hsl(261, 68%, 50%);

		--success: hsl(145, 65%, 39%);
		--success-hover: hsl(145, 65%, 34%);
		--overlay: hsla(0, 0%, 0%, 0.6);

		--error: hsl(0, 77%, 59%);
		--error-hover: hsl(0, 77%, 54%);
	}

	* {
		margin: 0;
		padding: 0;
		box-sizing: border-box;
		-webkit-user-select: none;
		user-select: none;
		-webkit-user-drag: none;
	}

	input,
	textarea,
	[contenteditable='true'] {
		-webkit-user-select: auto;
		user-select: auto;
	}

	#app {
		position: absolute;
		height: 100%;
		width: 100%;
		overflow: hidden;
		font-family: Arial, Helvetica, sans-serif;
		color: var(--text);
		background-color: var(--bg-dark);
	}

	button,
	input,
	optgroup,
	select,
	textarea {
		font-family: inherit;
	}

	.tauri #app {
		border-radius: 12px;
	}

	.tauri.maximized #app {
		border-radius: 0;
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
