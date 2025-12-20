import { defineStore } from 'pinia';
import type { Server, User } from '@/types';
import { getServerList, getServerMembers } from '@/api/state';

export const useServerStore = defineStore('servers', {
	state: () => ({
		servers: new Map<string, Server>(),
		selectedServerId: '' as string,
	}),
	getters: {
		getServerById: (state) => (id: string) => state.servers.get(id),
	},
	actions: {
		async initServers() {
			try {
				const serverList = await getServerList();
				this.servers = new Map(serverList.map((server) => [server.id, server]));
			} catch (e) {
				console.error('Failed to load servers:', e);
			}
		},

		async setMembers(server: Server) {
			try {
				const members = await getServerMembers(server);
				const srv = this.servers.get(server.id);
				if (srv) {
					srv.members = members;
				} else {
					console.warn(`Server ${server.id} not found`);
				}
			} catch (e) {
				console.error(`Failed to load members for server ${server.id}:`, e);
			}
		},

		selectServer(id: string) {
			this.selectedServerId = id;
		},

		getSelectedServer(): Server | undefined {
			return this.servers.get(this.selectedServerId);
		},

		getMembers(id: string): User[] {
			return this.servers.get(id)?.members || [];
		},
	},
});
