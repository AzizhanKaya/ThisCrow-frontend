<script setup lang="ts">
	import { useModalStore, ModalView } from '@/stores/modal';
	import { Icon } from '@iconify/vue';

	const modalStore = useModalStore();
</script>

<template>
	<div class="server-add" @click="modalStore.openModal(ModalView.CREATE_SERVER)">
		<Icon class="icon" icon="mdi:plus" />
	</div>
</template>

<style scoped>
	.server-add {
		position: relative;
		aspect-ratio: 1;
		border-radius: 50%;
		width: 100%;
		overflow: hidden;
		cursor: pointer;
		display: flex;
		justify-content: center;
		align-items: center;
		background-color: var(--bg);
		color: var(--success);
		transition:
			background-color 0.2s ease-in-out,
			border-radius 0.2s ease-in-out;
	}

	.server-add:hover {
		background-color: var(--color);
		color: white;
		border-radius: 10px;
	}

	.server-add .icon {
		font-size: 24px;
		transition: all 0.2s ease-in-out;
	}

	.server-add:hover .icon {
		transform: rotate(90deg);
	}
</style>
