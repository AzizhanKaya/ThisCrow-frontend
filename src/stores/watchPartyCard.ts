import { defineStore } from 'pinia';
import { ref, nextTick } from 'vue';
import type { id } from '@/types';

export const useWatchPartyCardStore = defineStore('watchPartyCard', () => {
	const show = ref(false);
	const x = ref(0);
	const y = ref(0);
	const target = ref<HTMLElement | undefined>(undefined);
	const server_id = ref<id | undefined>(undefined);
	const channel_id = ref<id | undefined>(undefined);
	const zIndex = ref<number>(0);

	async function open(params: {
		x: number;
		y: number;
		target: HTMLElement;
		server_id: id;
		channel_id: id;
		zIndex?: number;
	}) {
		if (show.value && channel_id.value === params.channel_id) return;

		if (show.value) {
			show.value = false;
			await nextTick();
		}

		x.value = params.x;
		y.value = params.y;
		target.value = params.target;
		server_id.value = params.server_id;
		channel_id.value = params.channel_id;
		zIndex.value = params.zIndex ?? 1000;
		show.value = true;
	}

	function close() {
		show.value = false;
	}

	return { show, x, y, target, server_id, channel_id, zIndex, open, close };
});
