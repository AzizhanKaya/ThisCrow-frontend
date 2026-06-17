import { defineStore } from 'pinia';
import type { Ack, Channel, Member, Message, OverrideTarget, Role, Server, WatchParty, id } from '@/types';
import { fetchServers } from '@/api/info';
import { useUserStore } from './user';
import { useMeStore } from './me';
import { useVoiceStore } from './voice';
import { websocketService } from '@/services/websocket';
import { AckType, ChannelType, EventType, MessageType, type Event, type Permissions } from '@/types';
import { generate_uid } from '@/utils/uid';
import { useWatchStore } from './watch';

function cascadePosition(collection: Iterable<{ id: id; position: number }>, movedId: id, oldPos: number, newPos: number) {
	if (oldPos === newPos) return;
	for (const item of collection) {
		if (item.id === movedId) continue;
		if (item.position > oldPos && item.position <= newPos) item.position -= 1;
		else if (item.position >= newPos && item.position < oldPos) item.position += 1;
	}
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
								group: { id, name, owner, icon, members: members_record, channels: channels_record, roles: roles_record },
								permissions,
								channel_permissions,
								voice_states,
							} = payload;

							if (voice_states) {
								const voiceStore = useVoiceStore();
								for (const [uid, vs] of Object.entries(voice_states)) {
									voiceStore.userStates.set(Number(uid), { muted: vs.mute, deafened: vs.deafen });
								}
							}

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
										permissions: channel_permissions[c.id] as Permissions | undefined,
									},
								])
							);

							const server = this.servers.get(server_id);
							if (server) {
								Object.assign(server, { members, channels, roles, owner, permissions });
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
									permissions: permissions as Permissions | undefined,
								});
							}
							this.server = this.servers.get(server_id)!;
						}
						break;

					case AckType.PermissionsChanged: {
						const { permissions, channel_permissions } = payload;
						server.permissions = permissions as Permissions;
						if (server.channels && channel_permissions) {
							for (const [cid, perms] of Object.entries(channel_permissions)) {
								const channel = server.channels.get(Number(cid));
								if (channel) {
									channel.permissions = perms as Permissions;
								}
							}
						}
						break;
					}

					case AckType.ChannelPermissionsChanged: {
						const channel = server.channels?.get(target_id);
						if (channel) channel.permissions = payload as Permissions;
						break;
					}

					case AckType.Unsubscribed:
						break;

					case AckType.DeletedGroup:
						this.servers.delete(server_id);
						if (this.server?.id === server_id) this.server = null;
						import('@/router').then((m) => {
							const router = m.default;
							if (router.currentRoute.value.params.serverId && Number(router.currentRoute.value.params.serverId) === server_id) {
								router.push('/');
							}
						});
						break;

					case AckType.UpdatedGroup: {
						for (const [k, v] of Object.entries(payload)) {
							if (v !== null && v !== undefined) (server as any)[k] = v;
						}
						break;
					}

					case AckType.JoinedMember:
						server.members?.set(target_id, {
							user: await userStore.getUser(target_id),
							roles: [],
						});
						break;

					case AckType.LeftMember:
						if (target_id === meStore.me?.id) {
							this.servers.delete(server_id);
							if (this.server?.id === server_id) this.server = null;
						} else {
							server.members?.delete(target_id);
						}
						break;

					case AckType.MovedGroup: {
						const oldPos = server.position;
						cascadePosition(this.servers.values(), server.id, oldPos, payload.position);
						server.position = payload.position;
						break;
					}

					case AckType.DeletedChannel: {
						server.channels?.delete(target_id);
						import('@/router').then((m) => {
							const router = m.default;
							const params = router.currentRoute.value.params;
							if (Number(params.serverId) === server_id && Number(params.channelId) === target_id) {
								router.push(`/server/${server_id}`);
							}
						});
						break;
					}

					case AckType.MovedToVoice: {
						const targetChannel = server.channels?.get(payload);
						if (!targetChannel) break;
						const user = await userStore.getUser(target_id);
						server.channels?.forEach((ch) => {
							ch.users?.delete(user);
						});
						if (!targetChannel.users) targetChannel.users = new Set();
						targetChannel.users.add(user);
						break;
					}

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
						if (payload.position != null && payload.position !== channel.position) {
							cascadePosition(server.channels!.values(), target_id, channel.position, payload.position);
						}
						for (const [k, v] of Object.entries(payload)) {
							if (v !== null && v !== undefined) (channel as any)[k] = v;
						}
						break;
					}

					case AckType.SetPermissionOverride: {
						const channel = server.channels?.get(target_id);
						if (!channel) return;
						if (!channel.permission_overrides) channel.permission_overrides = [];
						const { target, allow, deny } = payload;
						const sameTarget = (a: OverrideTarget, b: OverrideTarget): boolean =>
							('role' in a && 'role' in b && a.role === b.role) || ('user' in a && 'user' in b && a.user === b.user);
						const idx = channel.permission_overrides.findIndex((o) => sameTarget(o.target, target));
						if (idx >= 0) {
							channel.permission_overrides[idx] = { target, allow, deny };
						} else {
							channel.permission_overrides.push({ target, allow, deny });
						}
						channel.permission_overrides = [...channel.permission_overrides];
						break;
					}

					case AckType.DeletedPermissionOverride: {
						const channel = server.channels?.get(target_id);
						if (channel && channel.permission_overrides) {
							const { target } = payload;
							const sameTarget = (a: OverrideTarget, b: OverrideTarget): boolean =>
								('role' in a && 'role' in b && a.role === b.role) || ('user' in a && 'user' in b && a.user === b.user);
							const idx = channel.permission_overrides.findIndex((o) => sameTarget(o.target, target));
							if (idx >= 0) {
								channel.permission_overrides.splice(idx, 1);
								channel.permission_overrides = [...channel.permission_overrides];
							}
						}
						break;
					}

					case AckType.CreatedRole: {
						if (!server.roles) server.roles = new Map();
						server.roles.set(target_id, {
							id: target_id,
							name: payload.name,
							position: server.roles.size + 1,
							color: payload.color,
						});
						break;
					}

					case AckType.UpdatedRole: {
						if (target_id === 0) {
							if (payload.permissions !== null && payload.permissions !== undefined) {
								server.everyone = payload.permissions;
							}
							break;
						}
						const role = server.roles?.get(target_id);
						if (!role) return;
						if (payload.position != null && payload.position !== role.position) {
							cascadePosition(server.roles!.values(), target_id, role.position, payload.position);
						}
						for (const [k, v] of Object.entries(payload)) {
							if (v !== null && v !== undefined) (role as any)[k] = v;
						}
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
						const channel = server.channels?.get(payload.channel_id);
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
						this.removeFromParty(channel, target_id);
						break;
					}

					case AckType.JoinedParty: {
						const channel = server.channels?.get(target_id);
						if (!channel) return;
						if (channel.watch_party) {
							if (!channel.watch_party.users.includes(payload)) {
								channel.watch_party.users.push(payload);
							}
						} else {
							channel.watch_party = {
								video: 0,
								host: payload,
								users: [payload],
								offset: 0,
								playing: false,
							};
							const watchStore = useWatchStore();
							watchStore.setParty(channel.watch_party, channel.id, server_id);
						}
						break;
					}

					case AckType.LeftParty: {
						const channel = server.channels?.get(target_id);
						if (!channel) return;
						this.removeFromParty(channel, payload);

						break;
					}

					case AckType.Watching: {
						const channel = server.channels?.get(target_id);
						if (!channel || !channel.watch_party) return;

						channel.watch_party.video = payload.video;
						channel.watch_party.offset = 0;
						channel.watch_party.playing = false;
						channel.watch_party.title = payload.title || undefined;
						channel.watch_party.duration = payload.duration > 0 ? payload.duration : undefined;
						channel.watch_party.thumbnail = payload.thumbnail || undefined;

						break;
					}

					case AckType.JumpedTo: {
						const channel = server.channels?.get(target_id);
						if (!channel || !channel.watch_party) return;

						channel.watch_party.offset = payload.offset;
						channel.watch_party.playing = payload.play;

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

		async moveServer(server_id: id, position: number): Promise<any> {
			const meStore = useMeStore();
			const message: Message<Event> = {
				id: generate_uid(meStore.me!.id),
				from: meStore.me!.id,
				to: 0,
				group_id: server_id,
				type: MessageType.InfoGroup,
				data: { event: EventType.MoveGroup, payload: { position } },
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
			fields: { name?: string; position?: number; color?: string; permissions?: number }
		): Promise<any> {
			const meStore = useMeStore();
			const payload: Record<string, any> = { role: role_id };
			if (fields.name !== undefined) payload.name = fields.name;
			if (fields.position !== undefined) payload.position = fields.position;
			if (fields.color !== undefined) payload.color = fields.color;
			if (fields.permissions !== undefined) payload.permissions = fields.permissions;

			const message: Message<Event> = {
				id: generate_uid(meStore.me!.id),
				from: meStore.me!.id,
				to: 0,
				group_id: server_id,
				type: MessageType.InfoGroup,
				data: { event: EventType.UpdateRole, payload: payload as any },
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

		async updateChannel(server_id: id, channel_id: id, name?: string, title?: string, position?: number): Promise<any> {
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

		async setPermissionOverride(server_id: id, channel_id: id, target: OverrideTarget, allow: number, deny: number): Promise<any> {
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

		async kickUser(server_id: id, user_id: id): Promise<any> {
			const meStore = useMeStore();
			const message: Message<Event> = {
				id: generate_uid(meStore.me!.id),
				from: meStore.me!.id,
				to: user_id,
				group_id: server_id,
				type: MessageType.InfoGroup,
				data: { event: EventType.KickUser },
			};
			return websocketService.request(message);
		},

		async banUser(server_id: id, user_id: id): Promise<any> {
			const meStore = useMeStore();
			const message: Message<Event> = {
				id: generate_uid(meStore.me!.id),
				from: meStore.me!.id,
				to: user_id,
				group_id: server_id,
				type: MessageType.InfoGroup,
				data: { event: EventType.BanUser },
			};
			return websocketService.request(message);
		},

		async leaveServer(server_id: id): Promise<any> {
			const meStore = useMeStore();
			const message: Message<Event> = {
				id: generate_uid(meStore.me!.id),
				from: meStore.me!.id,
				to: meStore.me!.id,
				group_id: server_id,
				type: MessageType.InfoGroup,
				data: { event: EventType.LeaveGroup },
			};
			return websocketService.request(message);
		},

		async deleteServer(server_id: id): Promise<any> {
			const meStore = useMeStore();
			const message: Message<Event> = {
				id: generate_uid(meStore.me!.id),
				from: meStore.me!.id,
				to: 0,
				group_id: server_id,
				type: MessageType.InfoGroup,
				data: { event: EventType.DeleteGroup },
			};
			return websocketService.request(message);
		},

		async deleteChannel(server_id: id, channel_id: id): Promise<any> {
			const meStore = useMeStore();
			const message: Message<Event> = {
				id: generate_uid(meStore.me!.id),
				from: meStore.me!.id,
				to: channel_id,
				group_id: server_id,
				type: MessageType.InfoGroup,
				data: { event: EventType.DeleteChannel },
			};
			return websocketService.request(message);
		},

		removeFromParty(channel: Channel, user_id: id) {
			if (!channel.watch_party) return;
			const idx = channel.watch_party.users.indexOf(user_id);
			if (idx === -1) return;
			channel.watch_party.users.splice(idx, 1);
			if (channel.watch_party.users.length === 0) {
				channel.watch_party = undefined;
			} else if (channel.watch_party.host === user_id) {
				channel.watch_party.host = Math.min(...channel.watch_party.users);
			}
		},
	},
});
