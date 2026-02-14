import { defineStore } from 'pinia';
import type { User, id } from '@/types';
import { getDms } from '@/api/message';
import { fetchUser } from '@/api/state';
import { useUsersStore } from './users.ts';

export const useDMStore = defineStore('dm', {
	state: () => ({
		dms: [] as User[],
	}),
	getters: {},
	actions: {
		async init(dms: id[]) {
			const usersStore = useUsersStore();
			const users = await usersStore.getUsers(dms);
			this.dms = users;
		},

		isInDms(id: id): boolean {
			return this.dms.some((u) => u.id === id);
		},

		getUser(id: id) {
			return this.dms.find((u) => u.id === id);
		},

		async ensureUser(id: id) {
			if (this.isInDms(id)) return;
			const user = await fetchUser(id);
			this.dms.unshift(user);
		},

		async getOrFetchUser(id: id): Promise<User> {
			return this.getUser(id) || (await fetchUser(id));
		},
	},
});
