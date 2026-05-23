import { defineStore } from 'pinia';
import { ref, nextTick } from 'vue';
import type { User, Role } from '@/types';

export const useProfileCardStore = defineStore('profileCard', () => {
	const show = ref(false);
	const x = ref(0);
	const y = ref(0);
	const target = ref<HTMLElement | undefined>(undefined);
	const user = ref<User | null>(null);
	const roles = ref<Role[] | undefined>(undefined);
	const zIndex = ref<number>(0);

	async function open(params: {
		e?: MouseEvent;
		x?: number;
		y?: number;
		target?: HTMLElement;
		user: User;
		roles?: Role[];
		zIndex?: number;
	}) {
		if (show.value && user.value?.id === params.user.id) {
			show.value = false;
			return;
		}

		if (show.value) {
			show.value = false;
			await nextTick();
		}

		x.value = params.x ?? params.e?.clientX ?? 0;
		y.value = params.y ?? params.e?.clientY ?? 0;
		target.value = params.target ?? (params.e?.currentTarget as HTMLElement | undefined);
		user.value = params.user;
		roles.value = params.roles;
		zIndex.value = params.zIndex ?? 1000;
		show.value = true;
	}

	function close() {
		show.value = false;
	}

	return { show, x, y, target, user, roles, zIndex, open, close };
});
