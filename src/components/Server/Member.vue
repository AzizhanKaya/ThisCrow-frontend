<script setup lang="ts">
	import { useDMStore } from '@/stores/dm';
	import { useFriendStore } from '@/stores/friend';
	import { type Member, type User, Status, Permissions } from '@/types';
	import { can } from '@/utils/perms';
	import { ref, computed, nextTick } from 'vue';
	import { Icon } from '@iconify/vue';
	import { useRouter } from 'vue-router';
	import type { ContextMenuOption } from '@/components/ContextMenu.vue';
	import { useContextMenuStore } from '@/stores/contextMenu';
	import { useProfileCardStore } from '@/stores/profileCard';
	import { useServerStore } from '@/stores/server';
	import { useUserStore } from '@/stores/user';
	import { useMeStore } from '@/stores/me';
	import { useErrorStore } from '@/stores/error';
	import { getDefaultAvatar } from '@/utils/avatar';
	import { useModalStore, ModalView } from '@/stores/modal';
	import { useVoiceStore } from '@/stores/voice';

	const friendStore = useFriendStore();
	const serverStore = useServerStore();
	const userStore = useUserStore();
	const meStore = useMeStore();
	const errorStore = useErrorStore();
	const voiceStore = useVoiceStore();
	const modalStore = useModalStore();
	const contextMenuStore = useContextMenuStore();
	const profileCardStore = useProfileCardStore();
	const router = useRouter();

	const props = defineProps<{
		member: Member;
	}>();

	const user = computed(() => userStore.users.get(props.member.user.id) || props.member.user);

	const topRoleColor = computed(() => {
		const roles = props.member.roles;
		if (!roles || roles.length === 0) return undefined;
		return roles.reduce((top, r) => (r.position > top.position ? r : top)).color || undefined;
	});

	function getStatusClass(user: User): string {
		switch (user.status) {
			case Status.Online:
				return 'status-online';
			case Status.Idle:
				return 'status-idle';
			case Status.Dnd:
				return 'status-dnd';
			case Status.Offline:
			default:
				return 'status-offline';
		}
	}

	function getUserStatus(user: User): { emoji?: string; text: string } {
		if (user.activities?.game) return { emoji: '👾', text: user.activities.game.payload.name };
		if (user.activities?.music) return { emoji: '🎶', text: user.activities.music.payload.title };
		if (user.activities?.watching) return { emoji: '📺', text: '' };
		if (user.activities?.streaming) return { emoji: '🔴', text: '' };
		return { text: user.status };
	}

	function handleMessage(user: User) {
		router.push({ name: 'user', params: { userId: user.id.toString() } });
	}

	const roleOptions = computed<ContextMenuOption[]>(() => {
		if (!serverStore.server?.roles || serverStore.server.roles.size === 0) {
			return [
				{
					label: 'No roles',
					disabled: true,
				} as ContextMenuOption,
			];
		}
		return Array.from(serverStore.server.roles.values())
			.sort((a, b) => a.position - b.position)
			.map((role) => {
				return {
					label: role.name,
					action: 'toggle_role',
					checked: () => props.member.roles.some((r) => r.id === role.id),
					stayOpen: true,
					data: role.id,
					color: role.color,
				} as ContextMenuOption;
			});
	});

	const p = can(() => serverStore.server);
	const isSelf = computed(() => props.member.user.id === meStore.me?.id);
	const isTargetOwner = computed(() => serverStore.server?.owner === props.member.user.id);

	const contextMenuOptions = computed<ContextMenuOption[]>(() => {
		const opts: ContextMenuOption[] = [
			{ label: 'Profile', action: 'profile', icon: 'mdi:account' },
			{ label: 'Send Message', action: 'message', icon: 'mdi:message-text' },
			{ label: 'Call', action: 'call', icon: 'mdi:phone' },
		];

		if (p.manageRoles) {
			opts.push({ divider: true });
			opts.push({ label: 'Roles', icon: 'mdi:shield-account', children: roleOptions.value });
		}

		const canKick = p.kickMembers && !isSelf.value && !isTargetOwner.value;
		const canBan = p.banMembers && !isSelf.value && !isTargetOwner.value;
		if (canKick || canBan) {
			if (!p.manageRoles) opts.push({ divider: true });
			if (canKick) {
				opts.push({
					label: 'Kick @' + props.member.user.username,
					action: 'kick',
					icon: 'mdi:account-remove',
					variant: 'danger',
				});
			}
			if (canBan) {
				opts.push({
					label: 'Ban @' + props.member.user.username,
					action: 'ban',
					icon: 'mdi:account-cancel',
					variant: 'danger',
				});
			}
		}

		if (!isSelf.value) {
			opts.push({ divider: true });
			opts.push({ label: 'Remove Friend', action: 'unfriend', icon: 'mdi:account-remove', variant: 'danger' });
			opts.push({ label: 'Block', action: 'block', icon: 'mdi:cancel', variant: 'danger' });
		}

		return opts;
	});

	async function openContextMenu(e: MouseEvent) {
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();

		contextMenuStore.open({
			e,
			x: e.clientX - 250,
			y: rect.bottom + 4,
			options: contextMenuOptions.value,
			submenuDirection: 'left',
			minWidth: 260,
			onSelect: handleContextAction,
		});
	}

	function openProfileCard(e: MouseEvent) {
		const target = e.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();
		profileCardStore.open({
			target,
			x: rect.left - 350,
			y: rect.top,
			user: props.member.user,
			roles: props.member.roles,
		});
	}

	async function handleContextAction(action: string, option?: ContextMenuOption) {
		const user = props.member.user;
		const server_id = serverStore.server?.id;

		switch (action) {
			case 'message':
				handleMessage(user);
				break;
			case 'profile':
				modalStore.openModal(ModalView.PROFILE_CARD, { user });
				break;
			case 'call':
				await voiceStore.joinVoice(undefined, undefined, user);
				router.push({ name: 'user', params: { userId: user.id.toString() } });
				break;
			case 'unfriend':
				friendStore.removeFriend(user);
				break;
			case 'copy_username':
				navigator.clipboard.writeText(user.username);
				break;
			case 'toggle_role':
				if (server_id && option?.data !== undefined) {
					const roleId = option.data;
					const hasRole = props.member.roles.some((r) => r.id === roleId);
					try {
						if (hasRole) {
							await serverStore.removeRole(server_id, user.id, roleId);
						} else {
							await serverStore.assignRole(server_id, user.id, roleId);
						}
					} catch (e) {
						errorStore.pushFrom(e);
					}
				}
				break;
			case 'kick':
				if (server_id) {
					modalStore.openModal(ModalView.CONFIRM, {
						icon: 'mdi:account-remove',
						title: `Kick @${user.username}`,
						text: `Are you sure you want to kick ${user.name}? They can rejoin with a new invite.`,
						command: async () => {
							await serverStore.kickUser(server_id, user.id).catch((e) => errorStore.pushFrom(e, 'Failed to kick member'));
						},
					});
				}
				break;
			case 'ban':
				if (server_id) {
					modalStore.openModal(ModalView.CONFIRM, {
						icon: 'mdi:account-cancel',
						title: `Ban @${user.username}`,
						text: `Are you sure you want to ban ${user.name}? They will not be able to rejoin.`,
						command: async () => {
							await serverStore.banUser(server_id, user.id).catch((e) => errorStore.pushFrom(e, 'Failed to ban member'));
						},
					});
				}
				break;
		}
	}
</script>

<template>
	<div class="user-card" @click.stop="openProfileCard($event)" @contextmenu.prevent="openContextMenu($event)">
		<div class="user-info">
			<div class="avatar-container">
				<img :src="user.avatar || getDefaultAvatar(user.username)" alt="avatar" class="avatar loaded" />
				<div :class="['state', getStatusClass(user)]"></div>
			</div>
			<div class="user-text">
				<div class="names">
					<span class="name" :style="topRoleColor ? { color: topRoleColor } : undefined">{{ user.name }}</span>
					<span class="username">@{{ user.username }}</span>
				</div>
				<span class="status">
					<span v-if="getUserStatus(user).emoji" class="status-emoji">{{ getUserStatus(user).emoji }}</span>
					<span v-if="getUserStatus(user).text" class="status-text">{{ getUserStatus(user).text }}</span>
				</span>
			</div>
			<Icon class="crown" icon="mdi:crown" v-if="user.id === serverStore.server?.owner" />
		</div>
	</div>
</template>

<style scoped>
	.user-card {
		border-radius: 8px;
		padding: 4px 8px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		transition: background-color 0.2s;
	}

	.user-card:hover {
		background-color: var(--bg);
	}

	.user-info {
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 0;
		flex: 1;
		position: relative;
	}

	.crown {
		color: orange;
		position: absolute;
		left: 18px;
		top: -4px;
		transform: translate(-50%, -50%);
		font-size: 24px;
	}

	.avatar-container {
		position: relative;
		width: 35px;
		height: 35px;
		flex-shrink: 0;
	}

	.avatar {
		width: 100%;
		position: absolute;
		border-radius: 50%;
		background-color: var(--bg-dark);
		transition: opacity 0.1s ease-in;
		opacity: 0;
	}

	.avatar.loaded {
		opacity: 1;
	}

	.state {
		height: 12px;
		width: 12px;
		border-radius: 50%;
		position: absolute;
		z-index: 10;
		border: 2px #333 solid;
		left: 25px;
		bottom: 0px;
		flex-shrink: 0;
	}

	.user-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.names {
		display: flex;
		align-items: center;
		gap: 4px;
		min-width: 0;
	}

	.name {
		font-weight: 600;
		font-size: 1rem;
		color: var(--text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.username {
		font-weight: 100;
		font-size: 0.8rem;
		color: var(--text-muted);
		white-space: nowrap;
		flex-shrink: 0;
	}
	.name:hover {
		text-decoration: underline;
		cursor: pointer;
	}

	.status-container {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.status {
		color: #b9bbbe;
		font-size: 13px;
		display: flex;
		align-items: center;
		gap: 4px;
		min-width: 0;
	}

	.status-emoji {
		flex-shrink: 0;
		font-size: 12px;
		line-height: 1;
	}

	.status-text {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}
</style>
