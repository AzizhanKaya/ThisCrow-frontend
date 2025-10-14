import { defineStore } from 'pinia';
import type { User } from '@/types';
import { me } from '@/api/state';

export const useUserStore = defineStore('user', {
	state: () => ({
		user: undefined as User | null | undefined,
	}),
	getters: {
		isLoggedIn: (state) => !!state.user,
	},
	actions: {
		async initUser() {
			try {
				const user = await me();
				this.user = user;
			} catch (e) {
				console.error(e);
			}
		},
	},
});
