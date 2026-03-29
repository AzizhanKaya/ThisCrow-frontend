<script setup lang="ts">
	import { onMounted } from 'vue';
	import { useRouter, useRoute } from 'vue-router';
	import { useAppStore } from '@/stores/app';
	import Header from './components/Header.vue';
	import Modals from './components/Modals.vue';
	import VoiceAudioRenderer from './components/Voice/VoiceAudioRenderer.vue';

	const isTauri = !!(window as any).__TAURI_INTERNALS__;

	const appStore = useAppStore();
	const router = useRouter();
	const route = useRoute();

	onMounted(async () => {
		if (isTauri) {
			document.documentElement.classList.add('tauri');
		}

		window.addEventListener('beforeunload', appStore.handleBeforeUnload);

		await appStore.init(router);
	});
</script>

<template>
	<Header></Header>
	<router-view v-slot="{ Component }">
		<Transition name="fade" mode="out-in">
			<component :is="Component" :key="route.meta.layout" />
		</Transition>
	</router-view>
	<Modals />
	<VoiceAudioRenderer />
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
	html.tauri {
		background-color: transparent;
	}

	@font-face {
		font-family: 'gg sans';
		src: url('/fonts/gg sans.woff') format('woff');
		font-weight: normal;
		font-style: normal;
	}

	:root {
		--bg-darkest: hsl(216, 7%, 7%);
		--bg-darker: hsl(216, 7%, 10%);
		--bg-dark: hsl(216, 7%, 14%);
		--bg: hsl(216, 7%, 23%);
		--bg-light: hsl(216, 7%, 28%);
		--bg-lighter: hsl(216, 7%, 35%);
		--bg-lightest: hsl(216, 7%, 40%);

		--text: hsl(0 0% 95%);
		--text-muted: hsl(0 0% 75%);
		--text-subtle: hsl(216, 7%, 60%);

		--border: hsl(0, 0%, 19%);
		--border-muted: hsl(0, 0%, 15%);

		--color-darkest: hsl(261, 68%, 30%);
		--color-darker: hsl(261, 68%, 35%);
		--color-dark: hsl(261, 68%, 40%);
		--color: hsl(261, 68%, 45%);
		--color-light: hsl(261, 68%, 50%);
		--color-lighter: hsl(261, 68%, 55%);
		--color-lightest: hsl(261, 68%, 60%);

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
		scrollbar-width: thin;
		scrollbar-color: var(--bg) transparent;
	}

	::-webkit-scrollbar {
		width: 6px;
		height: 6px;
	}

	::-webkit-scrollbar-track {
		background: transparent;
	}

	::-webkit-scrollbar-thumb {
		background-color: var(--bg);
		border-radius: 10px;
	}

	::-webkit-scrollbar-thumb:hover {
		background-color: var(--bg-light);
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
		transition:
			opacity 0.3s ease-in-out,
			transform 0.3s ease-in;
		transform: translateY(0px);
	}
	.fade-enter-from,
	.fade-leave-to {
		transform: translateY(10px);
		opacity: 0;
	}
</style>
