<script setup>
	import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
	import { Icon } from '@iconify/vue';
	import { websocketService } from '@/services/websocket';

	const appWindow = await WebviewWindow.getByLabel('app');

	const minimize = () => appWindow.minimize();
	const toggleMaximize = () => {
		document.documentElement.classList.toggle('maximized');
		appWindow.toggleMaximize();
	};
	const closeApp = () => {
		websocketService.disconnect();
		appWindow.close();
	};
</script>

<template>
	<div class="window-controls">
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
</template>

<style scoped>
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
</style>
