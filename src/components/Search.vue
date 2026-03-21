<script setup>
	import { Icon } from '@iconify/vue';
</script>

<template>
	<div class="search">
		<input name="search" type="text" placeholder="Search" />
		<Icon icon="mdi:magnify" class="icon" />
	</div>
</template>

<style scoped>
	.search {
		width: 100%;
		padding-inline: 12px;
		position: relative;
	}

	input {
		width: 100%;
		padding: 4px;
		box-sizing: border-box;
		background-color: var(--bg-darker);
		border: 2px solid transparent;
		font-size: 1rem;
		outline: none;
		transition: 0.5s ease;
		font-weight: 200;
		padding-left: 40px;
		color: var(--text);
		border-radius: 10px;
	}

	.icon {
		width: 24px;
		height: 24px;
		position: absolute;
		left: 12px;
		top: 50%;
		transform: translateY(-50%);
		color: var(--text-muted);
		z-index: 10;
		color: var(--text);
	}
</style>
