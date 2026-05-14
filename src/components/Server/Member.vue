<script setup lang="ts">
	import { useDMStore } from '@/stores/dm';
	import { useFriendStore } from '@/stores/friend';
	import { type Member, type User, Status, Permissions } from '@/types';
	import { ref, computed } from 'vue';
	import ContextMenu from '@/components/ContextMenu.vue';
	import ProfileCard from '@/components/ProfileCard.vue';
	import { Icon } from '@iconify/vue';
	import { useRouter } from 'vue-router';
	import type { ContextMenuOption } from '@/components/ContextMenu.vue';
	import { useServerStore } from '@/stores/server';
	import { useUserStore } from '@/stores/user';
	import { useMeStore } from '@/stores/me';
	import { useErrorStore } from '@/stores/error';
	import { getDefaultAvatar } from '@/utils/avatar';
	import { useModalStore, ModalView } from '@/stores/modal';
	import { computeGroupPermissions } from '@/utils/permissions';
	import { useVoiceStore } from '@/stores/voice';

	const friendStore = useFriendStore();
	const serverStore = useServerStore();
	const userStore = useUserStore();
	const meStore = useMeStore();
	const errorStore = useErrorStore();
	const voiceStore = useVoiceStore();
	const modalStore = useModalStore();
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

	function getUserStatusText(user: User): string {
		if (user.activities?.game) return `Playing ${user.activities.game.payload.name}`;
		if (user.activities?.music) return `Listening to ${user.activities.music.payload.title}`;
		if (user.activities?.watching) return `Watching`;
		if (user.activities?.streaming) return `Streaming`;
		return user.status;
	}

	function handleMessage(user: User) {
		router.push({ name: 'user', params: { userId: user.id.toString() } });
	}

	const contextMenu = ref({
		show: false,
		x: 0,
		y: 0,
	});

	const profileCard = ref({
		show: false,
		x: 0,
		y: 0,
	});

	const roleOptions = computed<ContextMenuOption[]>(() => {
		if (!serverStore.server?.roles) return [];
		return Array.from(serverStore.server.roles.values())
			.sort((a, b) => a.position - b.position)
			.map((role) => {
				const hasRole = props.member.roles.some((r) => r.id === role.id);
				return {
					label: role.name,
					action: 'toggle_role',
					checked: hasRole,
					stayOpen: true,
					data: role.id,
					color: role.color,
				} as ContextMenuOption;
			});
	});

	const contextMenuOptions = computed<ContextMenuOption[]>(() => {
		const opts: ContextMenuOption[] = [
			{ label: 'Profile', action: 'profile', icon: 'mdi:account' },
			{ label: 'Send Message', action: 'message', icon: 'mdi:message-text' },
			{ label: 'Call', action: 'call', icon: 'mdi:phone' },
			{ divider: true },
			{ label: 'Roles', icon: 'mdi:shield-account', children: roleOptions.value },
			{
				label: 'Kick @' + props.member.user.username,
				action: 'kick',
				icon: 'mdi:account-remove',
				variant: 'danger',
			},
			{
				label: 'Ban @' + props.member.user.username,
				action: 'ban',
				icon: 'mdi:account-cancel',
				variant: 'danger',
			},
			{ divider: true },
			{ label: 'Remove Friend', action: 'unfriend', icon: 'mdi:account-remove', variant: 'danger' },
			{ label: 'Block', action: 'block', icon: 'mdi:cancel', variant: 'danger' },
		];

		return opts;
	});

	function openContextMenu(e: MouseEvent) {
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();

		contextMenu.value = {
			show: true,
			x: e.clientX - 250,
			y: rect.bottom + 4,
		};
	}

	function openProfileCard(e: MouseEvent) {
		if (profileCard.value.show) {
			profileCard.value.show = false;
			return;
		}
		document.dispatchEvent(new Event('click'));
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		profileCard.value = {
			show: true,
			x: rect.left - 350,
			y: rect.top,
		};
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

	function closeContextMenu() {
		contextMenu.value.show = false;
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
				<span class="status">{{ getUserStatusText(user) }}</span>
			</div>
			<Icon class="crown" icon="mdi:crown" v-if="user.id === serverStore.server?.owner" />
		</div>

		<ContextMenu
			:show="contextMenu.show"
			:x="contextMenu.x"
			:y="contextMenu.y"
			:options="contextMenuOptions"
			submenuDirection="left"
			@select="handleContextAction"
			@close="closeContextMenu"
			:min-width="260"
		/>

		<ProfileCard
			:user="member.user"
			:roles="member.roles"
			:show="profileCard.show"
			:x="profileCard.x"
			:y="profileCard.y"
			@close="profileCard.show = false"
		/>
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
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
