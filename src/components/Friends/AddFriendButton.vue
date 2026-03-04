<script setup lang="ts">
	import { Icon } from '@iconify/vue';
	import { useModalStore, ModalView } from '@/stores/modal';

	const modalStore = useModalStore();
</script>

<template>
	<div class="add-friend" @click="modalStore.openModal(ModalView.ADD_FRIEND)">
		<Icon icon="mdi:account-plus" class="icon" />
		<span class="text">Add Friend</span>
	</div>
</template>

<style scoped>
	.fade-enter-active,
	.fade-leave-active {
		transition: opacity 0.2s;
	}
	.fade-enter-from,
	.fade-leave-to {
		opacity: 0;
	}

	.add-friend {
		background-color: var(--color);
		color: white;
		border: none;
		border-radius: 4px;
		padding: 8px 16px;
		cursor: pointer;
		font-size: 15px;
		font-weight: 500;
		transition: background-color 0.2s;
		align-items: center;
		display: flex;
		gap: 6px;
	}

	.add-friend:hover {
		background-color: var(--color-light);
	}

	.icon {
		height: 20px;
		width: 20px;
	}

	.text {
		white-space: nowrap;
	}
</style>
