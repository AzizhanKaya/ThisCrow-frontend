import { defineStore } from 'pinia';
import type { Server } from '@/types';
import { getServerList } from '@/api/state';

export const useServerStore = defineStore('servers', {
	state: () => ({
		servers: [] as Server[],
	}),
	getters: {
		hasServers: (state) => !!state.servers,
	},
	actions: {
		setServers(servers: Server[]) {
			this.servers = servers;
		},

		async initServers() {
			try {
				const servers = await getServerList();
				this.setServers(servers);
			} catch (e) {
				console.error(e);
			}
		},
	},
});
