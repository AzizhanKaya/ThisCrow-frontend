import { defineStore } from 'pinia';
import type { User } from '@/types';
import { getDms } from '@/api/message';

export const useDMStore = defineStore('dm', {
	state: () => ({
		dms: [] as User[],
	}),
	getters: {},
	actions: {
		async initFriend() {
			try {
				this.dms = await getDms();
			} catch (e) {
				console.error(e);
			}
		},
	},
});
