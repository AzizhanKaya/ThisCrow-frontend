<script setup lang="ts">
	import { onMounted, ref } from 'vue';
	import { useMeStore } from '@/stores/me';
	import { useRouter, useRoute } from 'vue-router';
	import { initApp } from '@/init';
	import { websocketService } from '@/services/websocket';
	import { getMe } from '@/api/state';
	import { Icon } from '@iconify/vue';
	import { getCurrentWindow } from '@tauri-apps/api/window';

	const isTauri = !!(window as any).__TAURI_INTERNALS__;
	const appWindow = ref<any>(null);

	const minimize = () => appWindow.value?.minimize();
	const toggleMaximize = () => appWindow.value?.toggleMaximize();
	const closeApp = () => {
		websocketService.disconnect();
		appWindow.value?.close();
	};

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
				websocketService.disconnect();
				meStore.me = null;
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
			try {
				const currentWindow = getCurrentWindow();
				appWindow.value = currentWindow;
			} catch (err) {
				console.error('Tauri yüklenirken hata:', err);
			}
		}

		window.addEventListener('beforeunload', handleBeforeUnload);

		try {
			loading.value = true;
			await getMe();
			websocketService.connect();
		} catch (error) {
			console.error(error);
			meStore.me = null;
			router.push('/login');
			loading.value = false;
		}
	});
</script>

<template>
	<header data-tauri-drag-region class="header">
		<span>ThisCrow</span>
		<div v-if="isTauri" class="window-controls">
			<button @click="minimize" title="Minimize" class="titlebar-button">
				<Icon icon="mdi:window-minimize" />
			</button>
			<button @click="toggleMaximize" title="Maximize" class="titlebar-button">
				<Icon icon="mdi:window-maximize" />
			</button>
			<button @click="closeApp" title="Close" class="titlebar-button close-btn">
				<Icon icon="mdi:close" />
			</button>
		</div>
	</header>
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
		overflow: hidden;
	}

	.tauri body {
		background-color: transparent !important;
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
		font-family: Arial;
		color: var(--text);
		background-color: var(--bg-dark);
	}

	.tauri #app {
		border-radius: 12px;
	}
</style>

<style scoped>
	.header {
		height: 30px;
		width: 100%;
		color: white;
		padding: 0px 10px;
		font-family: 'Times New Roman', Times, serif;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
	}
	.window-controls {
		position: absolute;
		right: 0;
		top: 0;
		height: 100%;
		display: flex;
	}
	.titlebar-button {
		display: inline-flex;
		justify-content: center;
		align-items: center;
		width: 40px;
		height: 100%;
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.2s ease-in-out;
	}
	.titlebar-button:hover {
		background: var(--bg-light);
		color: var(--text);
	}
	.titlebar-button.close-btn:hover {
		background: #e81123;
		color: white;
	}

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
