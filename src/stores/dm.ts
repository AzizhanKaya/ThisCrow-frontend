import { defineStore } from 'pinia';
import type { User } from '@/types';
import { getDms } from '@/api/message';
import { getUser as getUserApi } from '@/api/state';

export const useDMStore = defineStore('dm', {
	state: () => ({
		dms: [] as User[],
	}),
	getters: {},
	actions: {
		async initDms() {
			try {
				this.dms = await getDms();
			} catch (e) {
				console.error(e);
			}
		},

		isInDms(user_id: string): boolean {
			return this.dms.some((user) => user.id === user_id);
		},

		getUser(id: string) {
			return this.dms.find((u) => u.id === id);
		},

		async ensureUser(id: string) {
			if (this.getUser(id)) return;
			const user = await getUserApi(id);
			this.dms.unshift(user);
		},
	},
});
