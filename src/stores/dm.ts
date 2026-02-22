import { defineStore } from 'pinia';
import type { User, id } from '@/types';
import { useUserStore } from './user.ts';

export const useDMStore = defineStore('dm', {
	state: () => ({
		dms: [] as User[],
		loading_users: new Set<id>(),
	}),
	getters: {
		isInDms:
			(state) =>
			(id: id): boolean => {
				return state.dms.some((u) => u.id === id);
			},

		getUser:
			(state) =>
			(id: id): User | undefined => {
				return state.dms.find((u) => u.id === id);
			},
	},
	actions: {
		async init(dms: id[]) {
			const userStore = useUserStore();
			this.dms = await userStore.getUsers(dms);
		},

		async ensureUser(id: id) {
			if (this.isInDms(id) || this.loading_users.has(id)) return;
			this.loading_users.add(id);
			const userStore = useUserStore();
			try {
				const user = await userStore.getUser(id);
				this.dms.push(user);
			} catch (e) {
				console.error(e);
			} finally {
				this.loading_users.delete(id);
			}
		},

		addUser(user: User) {
			this.dms.push(user);
		},
	},
});
