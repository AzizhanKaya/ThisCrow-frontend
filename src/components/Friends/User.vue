<script setup lang="ts">
	import { useDMStore } from '@/stores/dm';
	import { useFriendStore } from '@/stores/friend';
	import { type User, Status } from '@/types';
	import { ref } from 'vue';
	import ContextMenu from '@/components/ContextMenu.vue';
	import { Icon } from '@iconify/vue';
	import { useRouter } from 'vue-router';
	import type { ContextMenuOption } from '@/components/ContextMenu.vue';

	const friendStore = useFriendStore();
	const router = useRouter();

	const props = defineProps<{
		user: User;
		friend?: boolean;
		request?: boolean;
		request_sent?: boolean;
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

	async function handleMessage(user: User) {
		const dmStore = useDMStore();
		await dmStore.ensureUser(user.id);
		router.push({ name: 'user', params: { userId: user.id.toString() } });
	}

	const contextMenu = ref({
		show: false,
		x: 0,
		y: 0,
	});

	const contextMenuOptions: ContextMenuOption[] = [
		{ label: 'Profile', action: 'profile', icon: 'mdi:account' },
		{ label: 'Send Message', action: 'message', icon: 'mdi:message-text' },
		{ label: 'Call', action: 'call', icon: 'mdi:phone' },
		{ divider: true },
		{ label: 'Add Note', action: 'note', icon: 'mdi:pencil', subtext: 'Sadece sana görünür' },
		{ label: 'Add Nickname', action: 'nickname', icon: 'mdi:account-edit' },
		{ label: 'Invite to Server', action: 'invite', icon: 'mdi:account-plus', rightIcon: 'mdi:chevron-right' },
		{ divider: true },
		{ label: 'Remove Friend', action: 'unfriend', icon: 'mdi:account-remove', variant: 'danger' },
		{ label: 'Block', action: 'block', icon: 'mdi:cancel', variant: 'danger' },
		{ divider: true },
		{ label: 'Copy Username', action: 'copy_username', icon: 'mdi:content-copy' },
	];

	function openContextMenu(e: MouseEvent) {
		if (props.request || props.request_sent) return;
		contextMenu.value = {
			show: true,
			x: e.clientX,
			y: e.clientY,
		};
	}

	function handleContextAction(action: string) {
		const user = props.user;

		switch (action) {
			case 'message':
				handleMessage(user);
				break;
			case 'profile':
				console.log('Open profile for', user.username);
				break;
			case 'unfriend':
				friendStore.removeFriend(user);
				break;
			case 'copy_username':
				navigator.clipboard.writeText(user.username);
				break;
		}
	}

	function closeContextMenu() {
		contextMenu.value.show = false;
	}
</script>

<template>
	<div class="user-card" @contextmenu.prevent="openContextMenu($event)">
		<div class="user-info">
			<div class="avatar-container">
				<img :src="user.avatar || '/default-avatar.png'" alt="avatar" class="avatar loaded" />
				<div :class="['state', getState(user)]"></div>
			</div>
			<div class="user-text">
				<div class="names">
					<span class="name">{{ user.name }}</span>
					<span class="username">@{{ user.username }}</span>
				</div>
				<span class="status">{{ user.status }}</span>
			</div>
		</div>
		<div class="action-buttons">
			<button v-if="friend" class="icon-btn" @click.stop="handleMessage(user)" title="Send message">
				<Icon icon="mdi:message" />
			</button>
			<button v-if="friend" class="icon-btn" title="More options">
				<Icon icon="mdi:dots-vertical" />
			</button>
			<button v-if="request" @click="friendStore.acceptFriendRequest(user)" class="icon-btn success" title="Accept request">
				<Icon icon="mdi:check" />
			</button>
			<button v-if="request || request_sent" @click="friendStore.removeFriend(user)" class="icon-btn danger" title="Cancel request">
				<Icon icon="mdi:close" />
			</button>
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
	</div>
</template>

<style scoped>
	.user-card {
		border-radius: 8px;
		padding: 8px 12px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		transition: background-color 0.2s;
	}

	.user-card:hover {
		background-color: var(--bg-dark);
	}

	.user-info {
		display: flex;
		align-items: center;
		gap: 12px;
		flex: 1;
	}

	.avatar-container {
		position: relative;
	}

	.avatar {
		width: 40px;
		height: 40px;
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
		left: 29px;
		bottom: 5px;
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

	.action-buttons {
		display: flex;
		gap: 8px;
		opacity: 0;
		transition: opacity 0.2s;
	}

	.user-card:hover .action-buttons {
		opacity: 1;
	}

	.icon-btn {
		background-color: var(--bg-dark);
		color: var(--text-muted);
		border: none;
		border-radius: 50%;
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		font-size: 20px;
		transition: all 0.2s;
	}

	.icon-btn:hover {
		background-color: #3a3d44;
		color: #dcddde;
	}

	.icon-btn.success:hover {
		background-color: var(--success);
		color: white;
	}

	.icon-btn.danger:hover {
		background-color: var(--error);
		color: white;
	}
</style>
