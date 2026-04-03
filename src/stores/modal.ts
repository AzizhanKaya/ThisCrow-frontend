import { defineStore } from 'pinia';
import { ref } from 'vue';

export enum ModalView {
	ADD_FRIEND = 'ADD_FRIEND',
	CREATE_SERVER = 'CREATE_SERVER',
	CREATE_CHANNEL = 'CREATE_CHANNEL',
	CREATE_CATEGORY = 'CREATE_CATEGORY',
	USER_SETTINGS = 'USER_SETTINGS',
	NEW_DM = 'NEW_DM',
	INVITE = 'INVITE',
	JOIN_INVITE = 'JOIN_INVITE',
	CALLING = 'CALLING',
	WATCH_PARTY = 'WATCH_PARTY',
}

export const useModalStore = defineStore('modal', () => {
	const isOpen = ref(false);
	const view = ref<ModalView | null>(null);
	const data = ref<any>(null);

	function openModal(modalView: ModalView, modalData: any = null) {
		data.value = modalData;
		view.value = modalView;
		isOpen.value = true;
	}

	function closeModal() {
		isOpen.value = false;
		view.value = null;
		data.value = null;
	}

	return {
		isOpen,
		view,
		data,
		openModal,
		closeModal,
	};
});
