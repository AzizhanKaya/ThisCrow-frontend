<script setup lang="ts">
	import { useDMStore } from '@/stores/dm';
	import { useFriendStore } from '@/stores/friend';
	import { type Member, type User, Status } from '@/types';
	import { ref, computed } from 'vue';
	import ContextMenu from '@/components/ContextMenu.vue';
	import ProfileCard from '@/components/ProfileCard.vue';
	import { Icon } from '@iconify/vue';
	import { useRouter } from 'vue-router';
	import type { ContextMenuOption } from '@/components/ContextMenu.vue';
	import { useServerStore } from '@/stores/server';
	import { getDefaultAvatar } from '@/utils/avatar';
	import { useModalStore, ModalView } from '@/stores/modal';

	const friendStore = useFriendStore();
	const serverStore = useServerStore();
	const modalStore = useModalStore();
	const router = useRouter();

	const props = defineProps<{
		member: Member;
	}>();

	function getState(user: User): string {
		switch (user.status) {
			case Status.Online:
				return 'online';
			case Status.Idle:
				return 'idle';
			case Status.Dnd:
				return 'dnd';
			case Status.Offline:
				return 'offline';
		}
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
				} as ContextMenuOption;
			});
	});

	const contextMenuOptions = computed<ContextMenuOption[]>(() => [
		{ label: 'Profile', action: 'profile', icon: 'mdi:account' },
		{ label: 'Send Message', action: 'message', icon: 'mdi:message-text' },
		{ label: 'Call', action: 'call', icon: 'mdi:phone' },
		{ divider: true },
		{ label: 'Roles', icon: 'mdi:shield-account', children: roleOptions.value },
		{ divider: true },
		{ label: 'Remove Friend', action: 'unfriend', icon: 'mdi:account-remove', variant: 'danger' },
		{ label: 'Block', action: 'block', icon: 'mdi:cancel', variant: 'danger' },
		{ divider: true },
		{ label: 'Kick @' + props.member.user.username, action: 'kick', icon: 'mdi:account-remove', variant: 'danger' },
		{ label: 'Ban @' + props.member.user.username, action: 'ban', icon: 'mdi:account-cancel', variant: 'danger' },
	]);

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
		const target = ((e.currentTarget as HTMLElement).querySelector('.name') || e.currentTarget) as HTMLElement;
		const rect = target.getBoundingClientRect();
		profileCard.value = {
			show: true,
			x: rect.right + 14,
			y: rect.top - 10,
		};
	}

	function handleContextAction(action: string, option?: ContextMenuOption) {
		const user = props.member.user;
		const server_id = serverStore.server?.id;

		switch (action) {
			case 'message':
				handleMessage(user);
				break;
			case 'profile':
				modalStore.openModal(ModalView.PROFILE_CARD, { user });
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
					if (hasRole) {
						serverStore.removeRole(server_id, user.id, roleId);
					} else {
						serverStore.assignRole(server_id, user.id, roleId);
					}
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
				<img :src="member.user.avatar || getDefaultAvatar(member.user.username)" alt="avatar" class="avatar loaded" />
				<div :class="['state', getState(member.user)]"></div>
			</div>
			<div class="user-text">
				<div class="names">
					<span class="name">{{ member.user.name }}</span>
					<span class="username">@{{ member.user.username }}</span>
				</div>
				<span class="status">{{ member.user.status }}</span>
			</div>
			<Icon class="crown" icon="mdi:crown" v-if="member.user.id === serverStore.server?.owner" />
		</div>

		<ContextMenu
			:show="contextMenu.show"
			:x="contextMenu.x"
			:y="contextMenu.y"
			:options="contextMenuOptions"
			@select="handleContextAction"
			@close="closeContextMenu"
			:min-width="260"
		/>

		<ProfileCard
			:user="member.user"
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

	.state.online {
		background-color: #43b581;
	}
	.state.dnd {
		background-color: #f04747;
	}
	.state.idle {
		background-color: #e2e446;
	}
	.state.offline {
		background-color: #72767d;
	}

	.user-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.names {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.name {
		font-weight: 600;
		font-size: 1rem;
		color: var(--text);
	}
	.username {
		font-weight: 100;
		font-size: 0.8rem;
		color: var(--text-muted);
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
	}
</style>
