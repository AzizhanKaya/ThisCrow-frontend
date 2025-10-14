import { defineStore } from 'pinia';
import type { Server, User } from '@/types';
import { getServerList, getServerMembers } from '@/api/state';

export const useServerStore = defineStore('servers', {
	state: () => ({
		servers: [] as Server[],
		members: {} as Map<string, User[]>,
		selectedServerId: '' as string,
	}),
	getters: {
		getServerById: (state) => (id: string) => state.servers.find((s) => s.id === id),
		getMembersByServerId: (state) => (id: string) => state.members.get(id),
	},
	actions: {
		async initServers() {
			try {
				this.servers = await getServerList();
			} catch (e) {
				console.error('Failed to load servers:', e);
			}
		},

		async setMembers(server: Server) {
			try {
				const members = await getServerMembers(server);
				this.members = { ...this.members, [server.id]: members };
			} catch (e) {
				console.error(`Failed to load members for server ${server.id}:`, e);
			}
		},

		selectServer(id: string) {
			this.selectedServerId = id;
		},

		getSelectedServer(): Server | undefined {
			return this.servers.find((s) => s.id === this.selectedServerId);
		},

		getSelectedMembers(): User[] {
			return this.members[this.selectedServerId] || [];
		},
	},
});
