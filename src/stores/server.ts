import { defineStore } from 'pinia';
import type {
	Ack,
	Channel,
	Member,
	Message,
	OverrideTarget,
	PermissionOverride,
	Role,
	Server,
	User,
	WatchParty,
	id,
} from '@/types';
import { fetchServers } from '@/api/info';
import { useUserStore } from './user';
import { useMeStore } from './me';
import { websocketService } from '@/services/websocket';
import { AckType, ChannelType, EventType, MessageType, type Event } from '@/types';
import { generate_uid } from '@/utils/uid';

function sameTarget(a: OverrideTarget, b: OverrideTarget): boolean {
	return ('role' in a && 'role' in b && a.role === b.role) || ('user' in a && 'user' in b && a.user === b.user);
}

export const useServerStore = defineStore('server', {
	state: () => ({
		servers: new Map<id, Server>(),
		server: null as Server | null,
	}),
	getters: {
		getServerById: (state) => (id: id) => state.servers.get(id),
		getMembers: (state) => (id: id) => state.servers.get(id)!.members,
		getChannel: (state) => (id: id, channel_id: id) => state.servers.get(id)!.channels!.get(channel_id)!,
	},
	actions: {
		async init(server_ids: id[]) {
			const ready = (async () => {
				const fetched = await fetchServers(server_ids);
				this.servers = new Map(fetched.map((s) => [s.id, s]));
			})();

			websocketService.onMessage(MessageType.Server, async (message: Message<Ack>) => {
				await ready;
				const { ack, payload } = message.data;
				const server_id = message.from;
				if (server_id === 0) return;
				const target_id = message.to;
				const server = this.servers.get(server_id)!;

				const userStore = useUserStore();
				const meStore = useMeStore();

				switch (ack) {
					case AckType.CreatedGroup: {
						const max = [...this.servers.values()].reduce((max, s) => (s.position > max ? s.position : max), 0);
						const server = {
							id: server_id,
							...payload,
							position: max + 1,
						};
						this.servers.set(server_id, server);
						break;
					}

					case AckType.Subscribed:
						{
							const {
								id,
								name,
								owner,
								icon,
								members: members_record,
								channels: channels_record,
								roles: roles_record,
								everyone,
							}: {
								id: id;
								owner: id;
								name: string;
								icon?: string;
								members: Record<id, { id: id; name?: string; roles: id[] }>;
								channels: Record<
									id,
									{
										id: id;
										name: string;
										title: string | null;
										position: number;
										type: ChannelType;
										users?: id[];
										watch_party?: WatchParty;
										permission_overrides?: PermissionOverride[];
									}
								>;
								roles: Record<id, Role>;
								everyone: number;
							} = payload;

							const roles = new Map<id, Role>(Object.values(roles_record).map((r: Role) => [r.id, r]));

							const users = new Map((await userStore.getUsers(Object.values(members_record).map((m) => m.id))).map((u) => [u.id, u]));

							const members = new Map<id, Member>(
								Object.values(members_record).map((m) => [
									m.id,
									{
										user: users.get(m.id)!,
										roles: m.roles.map((rid) => roles.get(rid)!),
									},
								])
							);

							const channels = new Map<id, Channel>(
								Object.values(channels_record).map((c) => [
									c.id,
									{
										...c,
										users: new Set(c.users?.map((uid) => users.get(uid)!)),
									},
								])
							);

							const server = this.servers.get(server_id);
							if (server) {
								Object.assign(server, { members, channels, roles, owner, everyone });
							} else {
								this.servers.set(server_id, {
									id,
									name,
									icon,
									position: 0,
									members,
									channels,
									roles,
									owner,
									everyone,
								});
							}
							this.server = this.servers.get(server_id)!;
						}
						break;

					case AckType.Unsubscribed:
						break;

					case AckType.DeletedGroup:
						this.servers.delete(server_id);
						break;

					case AckType.UpdatedGroup:
						Object.assign(server, payload);
						break;

					case AckType.JoinedMember:
						server.members?.set(target_id, {
							user: await userStore.getUser(target_id),
							roles: [],
						});
						break;

					case AckType.RemovedMember:
						server.members?.delete(target_id);
						break;

					case AckType.CreatedChannel:
						server.channels?.set(target_id, {
							id: target_id,
							name: payload.name,
							title: payload.title || null,
							position: server.channels.size + 1,
							type: payload.is_voice ? ChannelType.Voice : ChannelType.Text,
						});

						break;

					case AckType.UpdatedChannel: {
						const channel = server.channels?.get(target_id);
						if (!channel) return;
						Object.assign(channel, payload);

						break;
					}

					case AckType.SetPermissionOverride: {
						const channel = server.channels?.get(target_id);
						if (!channel) return;
						if (!channel.permission_overrides) channel.permission_overrides = [];
						const { target, allow, deny } = payload;
						const idx = channel.permission_overrides.findIndex((o) => sameTarget(o.target, target));
						if (idx >= 0) {
							channel.permission_overrides[idx] = { target, allow, deny };
						} else {
							channel.permission_overrides.push({ target, allow, deny });
						}
						break;
					}

					case AckType.DeletedPermissionOverride: {
						const channel = server.channels?.get(target_id);
						if (!channel?.permission_overrides) return;
						channel.permission_overrides = channel.permission_overrides.filter((o) => !sameTarget(o.target, payload.target));
						break;
					}

					case AckType.CreatedRole: {
						if (!server.roles) server.roles = new Map();
						server.roles.set(target_id, {
							id: target_id,
							name: payload.name,
							position: server.roles.size + 1,
							color: payload.color,
							permissions: payload.permissions,
						});
						break;
					}

					case AckType.UpdatedRole: {
						if (target_id === 0) {
							if (typeof payload.permissions === 'number') {
								server.everyone = payload.permissions;
							}
							break;
						}
						const role = server.roles?.get(target_id);
						if (!role) return;
						Object.assign(role, payload);
						break;
					}

					case AckType.DeletedRole: {
						server.roles?.delete(target_id);
						server.members?.forEach((member) => {
							const index = member.roles.findIndex((r: any) => r.id === target_id);
							if (index !== -1) {
								member.roles.splice(index, 1);
							}
						});
						break;
					}

					case AckType.AssignedRole: {
						const member = server.members?.get(target_id);
						const role = server.roles?.get(payload.role_id);
						if (member && role && !member.roles.some((r) => r.id === role.id)) {
							member.roles.push(role);
						}
						break;
					}

					case AckType.RemovedRole: {
						const member = server.members?.get(target_id);
						if (member) {
							const index = member.roles.findIndex((r) => r.id === payload.role_id);
							if (index !== -1) {
								member.roles.splice(index, 1);
							}
						}
						break;
					}

					case AckType.JoinedVoice: {
						const channel = server.channels?.get(payload);
						if (!channel) return;
						if (!channel.users) channel.users = new Set();
						const user = await userStore.getUser(target_id);
						channel.users.add(user);

						break;
					}

					case AckType.ExitedVoice: {
						const channel = server.channels?.get(payload);
						if (!channel || !channel.users) return;
						const user = await userStore.getUser(target_id);
						channel.users.delete(user);
						break;
					}

					case AckType.JoinedParty: {
						for (const [, s] of this.servers) {
							const channel = s.channels?.get(target_id);
							if (!channel) continue;
							if (channel.watch_party) {
								if (!channel.watch_party.users.includes(target_id)) {
									channel.watch_party.users.push(target_id);
								}
							} else {
								channel.watch_party = {
									video: 0,
									host: target_id,
									users: [target_id],
									offset: 0,
									playing: false,
								};
							}
							break;
						}
						break;
					}

					case AckType.LeftParty: {
						for (const [, s] of this.servers) {
							for (const [, channel] of s.channels ?? []) {
								if (!channel.watch_party) continue;
								const idx = channel.watch_party.users.indexOf(target_id);
								if (idx === -1) continue;
								channel.watch_party.users.splice(idx, 1);
								if (channel.watch_party.users.length === 0) {
									channel.watch_party = undefined;
								} else if (channel.watch_party.host === target_id) {
									channel.watch_party.host = Math.min(...channel.watch_party.users);
								}
								break;
							}
						}
						break;
					}

					case AckType.Watching: {
						for (const [, s] of this.servers) {
							for (const [, channel] of s.channels ?? []) {
								if (!channel.watch_party) continue;
								if (channel.watch_party.host !== target_id) continue;
								channel.watch_party.video = payload.video;
								channel.watch_party.offset = 0;
								channel.watch_party.playing = false;
								break;
							}
						}
						break;
					}

					case AckType.JumpedTo: {
						for (const [, s] of this.servers) {
							for (const [, channel] of s.channels ?? []) {
								if (!channel.watch_party) continue;
								if (channel.watch_party.host !== target_id) continue;
								channel.watch_party.offset = payload.offset;
								channel.watch_party.playing = payload.play;
								break;
							}
						}
						break;
					}
				}
			});

			await ready;
		},

		async createServer(name: string, description?: string, icon?: string): Promise<any> {
			const meStore = useMeStore();

			const message: Message<Event> = {
				id: generate_uid(meStore.me!.id),
				from: meStore.me!.id,
				to: 0,
				type: MessageType.Info,
				data: { event: EventType.CreateGroup, payload: { name, description, icon } },
			};

			return websocketService.request(message);
		},

		async subscribeToServer(server_id: id) {
			const meStore = useMeStore();
			if (!meStore.me) return;
			const message: Message<Event> = {
				id: generate_uid(meStore.me.id),
				from: meStore.me.id,
				to: 0,
				group_id: server_id,
				type: MessageType.InfoGroup,
				data: { event: EventType.Subscribe },
			};
			return websocketService.request(message);
		},

		async unsubscribeFromServer(server_id: id) {
			const meStore = useMeStore();
			if (!meStore.me) return;
			return websocketService.request({
				id: generate_uid(meStore.me.id),
				from: meStore.me.id,
				to: 0,
				group_id: server_id,
				type: MessageType.InfoGroup,
				data: { event: EventType.Unsubscribe },
			});
		},

		async updateServer(server_id: id, name?: string, description?: string, icon?: string): Promise<any> {
			const meStore = useMeStore();
			const message: Message<Event> = {
				id: generate_uid(meStore.me!.id),
				from: meStore.me!.id,
				to: 0,
				group_id: server_id,
				type: MessageType.InfoGroup,
				data: { event: EventType.UpdateGroup, payload: { name, description, icon } },
			};
			return websocketService.request(message);
		},

		async createRole(server_id: id, name: string, color: string, permissions: number): Promise<any> {
			const meStore = useMeStore();
			const message: Message<Event> = {
				id: generate_uid(meStore.me!.id),
				from: meStore.me!.id,
				to: 0,
				group_id: server_id,
				type: MessageType.InfoGroup,
				data: { event: EventType.CreateRole, payload: { name, color, permissions } },
			};
			return websocketService.request(message);
		},

		async updateRole(
			server_id: id,
			role_id: id,
			name?: string,
			position?: number,
			color?: string,
			permissions?: number
		): Promise<any> {
			const meStore = useMeStore();
			const message: Message<Event> = {
				id: generate_uid(meStore.me!.id),
				from: meStore.me!.id,
				to: 0,
				group_id: server_id,
				type: MessageType.InfoGroup,
				data: { event: EventType.UpdateRole, payload: { role: role_id, name, position, color, permissions } },
			};
			return websocketService.request(message);
		},

		async deleteRole(server_id: id, role_id: id): Promise<any> {
			const meStore = useMeStore();
			const message: Message<Event> = {
				id: generate_uid(meStore.me!.id),
				from: meStore.me!.id,
				to: 0,
				group_id: server_id,
				type: MessageType.InfoGroup,
				data: { event: EventType.DeleteRole, payload: { role: role_id } },
			};
			return websocketService.request(message);
		},

		async assignRole(server_id: id, user_id: id, role_id: id): Promise<any> {
			const meStore = useMeStore();
			const message: Message<Event> = {
				id: generate_uid(meStore.me!.id),
				from: meStore.me!.id,
				to: 0,
				group_id: server_id,
				type: MessageType.InfoGroup,
				data: { event: EventType.AssignRole, payload: { user: user_id, role: role_id } },
			};
			return websocketService.request(message);
		},

		async removeRole(server_id: id, user_id: id, role_id: id): Promise<any> {
			const meStore = useMeStore();
			const message: Message<Event> = {
				id: generate_uid(meStore.me!.id),
				from: meStore.me!.id,
				to: 0,
				group_id: server_id,
				type: MessageType.InfoGroup,
				data: { event: EventType.RemoveRole, payload: { user: user_id, role: role_id } },
			};
			return websocketService.request(message);
		},

		async updateChannel(
			server_id: id,
			channel_id: id,
			name?: string,
			title?: string,
			position?: number
		): Promise<any> {
			const meStore = useMeStore();
			const message: Message<Event> = {
				id: generate_uid(meStore.me!.id),
				from: meStore.me!.id,
				to: channel_id,
				group_id: server_id,
				type: MessageType.InfoGroup,
				data: { event: EventType.UpdateChannel, payload: { name, title, position } },
			};
			return websocketService.request(message);
		},

		async setPermissionOverride(
			server_id: id,
			channel_id: id,
			target: OverrideTarget,
			allow: number,
			deny: number
		): Promise<any> {
			const meStore = useMeStore();
			const message: Message<Event> = {
				id: generate_uid(meStore.me!.id),
				from: meStore.me!.id,
				to: channel_id,
				group_id: server_id,
				type: MessageType.InfoGroup,
				data: { event: EventType.SetPermissionOverride, payload: { target, allow, deny } },
			};
			return websocketService.request(message);
		},

		async deletePermissionOverride(server_id: id, channel_id: id, target: OverrideTarget): Promise<any> {
			const meStore = useMeStore();
			const message: Message<Event> = {
				id: generate_uid(meStore.me!.id),
				from: meStore.me!.id,
				to: channel_id,
				group_id: server_id,
				type: MessageType.InfoGroup,
				data: { event: EventType.DeletePermissionOverride, payload: { target } },
			};
			return websocketService.request(message);
		},
	},
});
