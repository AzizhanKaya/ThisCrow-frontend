import { defineStore } from 'pinia';
import type { Server, User, id } from '@/types';
import { getServerList, getServerMembers } from '@/api/state';

export const useServerStore = defineStore('servers', {
	state: () => ({
		servers: new Map<id, Server>(),
		selectedServerId: undefined as id | undefined,
	}),
	getters: {
		getServerById: (state) => (id: id) => state.servers.get(id),
	},
	actions: {
		async init() {
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

		selectServer(id: id) {
			this.selectedServerId = id;
		},

		getSelectedServer(): Server | undefined {
			if (this.selectedServerId === undefined) return undefined;
			return this.servers.get(this.selectedServerId);
		},

		getMembers(id: id): User[] {
			return this.servers.get(id)?.members || [];
		},
	},
});
