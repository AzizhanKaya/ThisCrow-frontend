<script setup lang="ts">
	import WindowControls from './WindowControls.vue';
	import { useAppStore } from '@/stores/app';
	const appStore = useAppStore();

	const isTauri = !!(window as any).__TAURI_INTERNALS__;
</script>

<template>
	<div class="header" data-tauri-drag-region>
		<span data-tauri-drag-region>{{ appStore.header }}</span>
		<Suspense>
			<WindowControls v-if="isTauri" />
		</Suspense>
	</div>
</template>

<style scoped>
	.header {
		height: 30px;
		width: 100%;
		color: white;
		padding: 0px 10px;
		font-family: 'Times New Roman' !important;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
	}
</style>
