<script setup lang="ts">
	import WindowControls from './WindowControls.vue';

	const isTauri = !!(window as any).__TAURI_INTERNALS__;
</script>

<template>
	<div class="header" data-tauri-drag-region>
		<span>ThisCrow</span>
		<WindowControls v-if="isTauri" />
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
