import { defineStore } from 'pinia';
import type { User } from '@/types';
import { me } from '@/api/state';

export const useUserStore = defineStore('user', {
	state: () => ({
		user: null as User | null,
	}),
	getters: {
		isLoggedIn: (state) => !!state.user,
	},
	actions: {
		setUser(user: User) {
			this.user = user;
		},
		clearUser() {
			this.user = null;
		},
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
