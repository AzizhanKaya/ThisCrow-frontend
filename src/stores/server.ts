import { defineStore } from 'pinia';
import type { Ack, Message, Server, User, id } from '@/types';
import { fetchServers } from '@/api/info';
import { useUserStore } from './user';
import { websocketService } from '@/services/websocket';
import { AckType, EventType, MessageType } from '@/types';

export const useServerStore = defineStore('servers', {
	state: () => ({
		servers: new Map<id, Server>(),
		selectedServer: undefined as id | undefined,
	}),
	getters: {
		getServerById: (state) => (id: id) => state.servers.get(id),
		getMembers: (state) => (id: id) => state.servers.get(id)?.members,
	},
	actions: {
		setupListeners() {
			websocketService.onMessage(MessageType.Server, async (message: Message<Ack>) => {
				const { ack, payload } = message.data;
				const serverId = message.group_id!;
				const server = this.servers.get(serverId);

				switch (ack) {
					case AckType.Subscribed:
						this.setServer(payload);
						break;

					case AckType.Unsubscribed:
					case AckType.DeletedGroup:
						this.servers.delete(payload);
						if (this.selectedServer === payload) this.selectedServer = undefined;
						break;

					case AckType.UpdatedGroup:
						if (server) Object.assign(server, payload);
						break;

					case AckType.CreatedChannel:
						if (server) {
							server.channels = [...(server.channels ?? []), payload];
						}
						break;

					case AckType.UpdatedChannel:
						if (server?.channels) {
							server.channels = server.channels.map((c) => (c.id === payload.id ? { ...c, ...payload } : c));
						}
						break;

					case AckType.DeletedChannel:
						if (server?.channels) {
							server.channels = server.channels.filter((c) => c.id !== payload);
						}
						break;

					case AckType.AddedMember:
						// Not: Member verisi tam değilse userStore'dan çekmek gerekebilir
						// server.members = [...(server.members ?? []), newMember];
						break;

					case AckType.RemovedMember:
						if (server?.members) {
							server.members = server.members.filter((m) => m.id !== payload);
						}
						break;

					case AckType.CreatedRole:
						if (server) {
							server.roles = [...(server.roles ?? []), payload];
						}
						break;

					case AckType.DeletedRole:
						if (server?.roles) {
							server.roles = server.roles.filter((r) => r.id !== payload);
						}
						break;

					case AckType.Error:
						console.error('Server Error:', payload);
						break;

					default:
						console.warn('İşlenmemiş Ack Tipi:', ack);
				}
			});
		},

		async init(server_ids: id[]) {
			this.servers = new Map((await fetchServers(server_ids)).map((server) => [server.id, server]));
		},

		setServer(server: Server) {
			const existing = this.servers.get(server.id);
			if (existing) {
				Object.assign(existing, server);
			} else {
				this.servers.set(server.id, server);
			}
		},

		async setMembers(server_id: id, members: id[]) {
			const userStore = useUserStore();
			const server = this.servers.get(server_id);

			if (server) {
				server.members = await userStore.getUsers(members);
			}
		},

		selectServer(id: id) {
			this.selectedServer = id;
		},

		getSelectedServer(): Server | undefined {
			if (this.selectedServer === undefined) return undefined;
			return this.servers.get(this.selectedServer);
		},
	},
});
