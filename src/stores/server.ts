import { defineStore } from 'pinia';
import type { Ack, Message, Server, User, id } from '@/types';
import { fetchServers } from '@/api/info';
import { useUserStore } from './user';
import { useMeStore } from './me';
import { websocketService } from '@/services/websocket';
import { AckType, EventType, MessageType, type Event } from '@/types';

export const useServerStore = defineStore('servers', {
	state: () => ({
		servers: new Map<id, Server>(),
		selectedServer: undefined as id | undefined,
		selectedChannel: undefined as id | undefined,
		channelMessages: new Map<id, Message[]>(),
	}),
	getters: {
		getServerById: (state) => (id: id) => state.servers.get(id)!,
		getMembers: (state) => (id: id) => state.servers.get(id)!.members,
		getServer: (state) => (id: id) => state.servers.get(id)!,
	},
	actions: {
		setupListeners() {
			websocketService.onMessage(MessageType.Server, async (message: Message<Ack>) => {
				const { ack, payload } = message.data;
				const server_id = message.from;
				const target_id = message.to;
				const server = this.servers.get(server_id)!;

				switch (ack) {
					case AckType.CreatedGroup: {
						const max = [...this.servers.values()].reduce((max, s) => (s.position > max ? s.position : max), 0n);
						const server = {
							id: message.id,
							version: 0n,
							...payload,
							position: max + 1n,
						};
						this.servers.set(message.id, server);
						break;
					}

					case AckType.Subscribed:
						await this.setMembers(server, payload.members as unknown as id[]);
						this.setServer(payload);

						break;

					case AckType.Unsubscribed:
					case AckType.DeletedGroup:
						this.servers.delete(server_id);
						if (this.selectedServer === server_id) this.selectedServer = undefined;
						break;

					case AckType.UpdatedGroup:
						Object.assign(server, payload);
						break;

					case AckType.CreatedChannel:
						server.channels = [...(server.channels ?? []), { id: target_id, ...payload }];
						break;

					case AckType.UpdatedChannel:
						if (server.channels) {
							server.channels = server.channels.map((c) => (c.id === target_id ? { ...c, ...payload } : c));
						}
						break;

					case AckType.DeletedChannel:
						if (server?.channels) {
							server.channels = server.channels.filter((c) => c.id !== target_id);
						}
						break;

					case AckType.RemovedMember:
						if (server?.members) {
							server.members = server.members.filter((m) => m.user.id !== target_id);
						}
						break;

					case AckType.CreatedRole:
						if (server) {
							server.roles = [...(server.roles ?? []), { id: target_id, ...payload }];
						}
						break;

					case AckType.DeletedRole:
						if (server?.roles) {
							server.roles = server.roles.filter((r) => r.id !== target_id);
						}
						break;

					case AckType.Error:
						console.error('Server Error:', payload);
						break;
				}
			});

			websocketService.onMessage(MessageType.Group, (message: Message) => {
				const channel_id = message.to;
				if (!this.channelMessages.has(channel_id)) {
					this.channelMessages.set(channel_id, []);
				}
				const messages = this.channelMessages.get(channel_id)!;
				if (!messages.some((m) => m.id === message.id)) {
					messages.push(message);
				}
			});
		},

		async init(server_ids: id[]) {
			const fetched = await fetchServers(server_ids);

			this.servers = new Map(fetched.map((s) => [s.id, s]));

			server_ids.forEach((id) => {
				const server = this.servers.get(id);
				if (server) {
					this.server_list.push(server);
				}
			});
		},

		setServer(server: Server) {
			const existing = this.servers.get(server.id);
			if (existing) {
				Object.assign(existing, server);
			} else {
				this.servers.set(server.id, server);
			}
		},

		async setMembers(server: Server, members: id[]) {
			const userStore = useUserStore();
			const users = await userStore.getUsers(members);
			server.members = users.map((user) => ({ user, roles: [] }));
		},

		selectServer(id: id) {
			this.selectedServer = id;
		},

		selectChannel(id: id) {
			this.selectedChannel = id;
		},

		getChannelMessages(channelId: id): Message[] {
			return this.channelMessages.get(channelId) || [];
		},

		createServer(name: string, description?: string, icon?: string) {
			const meStore = useMeStore();
			if (!meStore.me) return;
			const message: Message<Event> = {
				id: 0n,
				from: meStore.me.id,
				to: 0n,
				type: MessageType.Info,
				time: new Date(),
				data: { event: EventType.CreateGroup, payload: { name, description, icon } },
			};
			websocketService.sendMessage(message);
		},

		subscribeToServer(server_id: id) {
			const meStore = useMeStore();
			if (!meStore.me) return;
			const message: Message<Event> = {
				id: 0n,
				from: meStore.me.id,
				to: 0n,
				group_id: server_id,
				type: MessageType.InfoGroup,
				time: new Date(),
				data: { event: EventType.Subscribe },
			};
			websocketService.sendMessage(message);
		},

		unsubscribeFromServer(server_id: id) {
			const meStore = useMeStore();
			if (!meStore.me) return;
			const message: Message<Event> = {
				id: 0n,
				from: meStore.me.id,
				to: 0n,
				group_id: server_id,
				type: MessageType.InfoGroup,
				time: new Date(),
				data: { event: EventType.Unsubscribe },
			};
			websocketService.sendMessage(message);
		},
	},
});
