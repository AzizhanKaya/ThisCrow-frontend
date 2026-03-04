<script setup lang="ts">
	import { ModalView, useModalStore } from '@/stores/modal';
	import AddFriend from '@/modals/AddFriend.vue';
	import CreateServer from '@/modals/CreateServer.vue';
	import NewDm from '@/modals/NewDm.vue';

	const modalStore = useModalStore();
</script>

<template>
	<div class="modal">
		<Transition name="fade" mode="out-in">
			<AddFriend v-if="modalStore.view === ModalView.ADD_FRIEND" />
			<CreateServer v-else-if="modalStore.view === ModalView.CREATE_SERVER" />
			<NewDm v-else-if="modalStore.view === ModalView.NEW_DM" />
		</Transition>
	</div>
</template>

<style scoped>
	.fade-enter-active,
	.fade-leave-active {
		transition: opacity 0.2s ease;
	}

	.fade-enter-from,
	.fade-leave-to {
		opacity: 0;
	}
</style>
