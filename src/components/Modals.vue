<script setup lang="ts">
	import { ModalView, useModalStore } from '@/stores/modal';
	import AddFriend from '@/modals/AddFriend.vue';
	import CreateServer from '@/modals/CreateServer.vue';
	import CreateChannel from '@/modals/CreateChannel.vue';
	import CreateCategory from '@/modals/CreateCategory.vue';
	import NewDm from '@/modals/NewDm.vue';
	import Invite from '@/modals/Invite.vue';
	import JoinInvite from '@/modals/JoinInvite.vue';
	import Calling from '@/modals/Calling.vue';
	import WatchParty from '@/modals/WatchParty.vue';
	import ProfileCard from '@/modals/ProfileCard.vue';
	import ServerSettings from '@/modals/ServerSettings.vue';

	const modalStore = useModalStore();
</script>

<template>
	<div class="modal">
		<Transition name="fade" mode="out-in">
			<AddFriend v-if="modalStore.view === ModalView.ADD_FRIEND" />
			<CreateServer v-else-if="modalStore.view === ModalView.CREATE_SERVER" />
			<CreateChannel v-else-if="modalStore.view === ModalView.CREATE_CHANNEL" />
			<CreateCategory v-else-if="modalStore.view === ModalView.CREATE_CATEGORY" />
			<NewDm v-else-if="modalStore.view === ModalView.NEW_DM" />
			<Invite v-else-if="modalStore.view === ModalView.INVITE" />
			<JoinInvite v-else-if="modalStore.view === ModalView.JOIN_INVITE" />
			<Calling v-else-if="modalStore.view === ModalView.CALLING" />
			<WatchParty v-else-if="modalStore.view === ModalView.WATCH_PARTY" />
			<ProfileCard v-else-if="modalStore.view === ModalView.PROFILE_CARD" />
			<ServerSettings v-else-if="modalStore.view === ModalView.SERVER_SETTINGS" />
		</Transition>
	</div>
</template>

<style scoped>
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		background-color: var(--overlay);
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.fade-enter-active,
	.fade-leave-active {
		transition: opacity 0.2s ease;
	}

	.fade-enter-from,
	.fade-leave-to {
		opacity: 0;
	}
</style>
