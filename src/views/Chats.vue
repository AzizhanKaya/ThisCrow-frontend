<script setup lang="ts">
	import { computed, ref, watch } from 'vue';
	import type { id } from '@/types';
	import User from '@/components/User.vue';
	import type { User as UserType } from '@/types';
	import { useDMStore } from '@/stores/dm';
	import { useUserStore } from '@/stores/user';
	import { useRouter, useRoute } from 'vue-router';
	import AsideButton from '@/components/AsideButton.vue';
	import { RouterView } from 'vue-router';
	import { Icon } from '@iconify/vue';
	import ContextMenu, { type ContextMenuOption } from '@/components/ContextMenu.vue';
	import { useModalStore, ModalView } from '@/stores/modal';
	import { useFriendStore } from '@/stores/friend';
	import Search from '@/components/Search.vue';
	import { removeDM } from '@/api/message';

	const dmStore = useDMStore();
	const userStore = useUserStore();
	const friendStore = useFriendStore();
	const modalStore = useModalStore();

	const router = useRouter();
	const route = useRoute();

	const user_id = computed(() => route.params.userId as string);
	const reversedDms = computed(() => Array.from(dmStore.dms).reverse());

	function handleUserClick(user: UserType) {
		router.push({ name: 'user', params: { userId: user.id.toString() } });
	}

	const contextMenu = ref({
		show: false,
		x: 0,
		y: 0,
		options: [] as ContextMenuOption[],
		user: null as UserType | null,
	});

	function openContextMenu(e: MouseEvent, user: UserType) {
		const are_friends = friendStore.isFriend(user.id);

		const ContextMenuoptions: ContextMenuOption[] = [
			{ label: 'Profile', action: 'profile', icon: 'mdi:account' },
			{ label: 'Send Message', action: 'message', icon: 'mdi:message-text' },
			{ label: 'Call', action: 'call', icon: 'mdi:phone' },
			{ divider: true },

			{ label: 'Add Note', action: 'note', icon: 'mdi:pencil', subtext: 'Sadece sana görünür' },
			{ label: 'Add Nickname', action: 'nickname', icon: 'mdi:account-edit' },
			{ label: 'Invite to Server', action: 'invite', icon: 'mdi:account-plus', rightIcon: 'mdi:chevron-right' },

			...(are_friends
				? [{ divider: true }, { label: 'Remove Friend', action: 'unfriend', icon: 'mdi:account-remove', variant: 'danger' as const }]
				: [{ label: 'Add Friend', action: 'add_friend', icon: 'mdi:account-plus', variant: 'success' as const }, { divider: true }]),
			{ label: 'Remove DM', action: 'remove_dm', icon: 'mdi:delete', variant: 'danger' },
			{ label: 'Block', action: 'block', icon: 'mdi:cancel', variant: 'danger' },
			{ divider: true },
			{ label: 'Copy Username', action: 'copy_username', icon: 'mdi:content-copy' },
		];

		contextMenu.value = {
			show: true,
			x: e.clientX,
			y: e.clientY,
			user,
			options: ContextMenuoptions,
		};
	}

	function handleMessage(user: UserType) {
		router.push({ name: 'user', params: { userId: user.id.toString() } });
	}

	function handleContextAction(action: string) {
		const user = contextMenu.value.user;
		if (!user) return;

		switch (action) {
			case 'profile':
				modalStore.openModal(ModalView.PROFILE_CARD, { user });
				break;
			case 'message':
				handleMessage(user);
				break;
			case 'call':
				// TODO: Implement call
				break;
			case 'note':
				// TODO: Implement note
				break;
			case 'nickname':
				// TODO: Implement nickname
				break;
			case 'invite':
				// TODO: Implement invite
				break;
			case 'remove_dm':
				removeDM(user.id);
				dmStore.dms = dmStore.dms.filter((u) => u.id !== user.id);
				if (router.currentRoute.value.params.userId === user.id.toString()) {
					router.push({ name: 'chats' });
				}
				break;
			case 'add_friend':
				friendStore.sendFriendRequest(user);
				break;
			case 'unfriend':
				friendStore.removeFriend(user);
				break;
			case 'block':
				break;
			case 'copy_username':
				navigator.clipboard.writeText(user.username);
				break;
		}
	}

	function openDM() {
		modalStore.openModal(ModalView.NEW_DM);
	}
</script>

<template>
	<div class="chats-view">
		<aside>
			<div class="button-container">
				<AsideButton icon="mdi:account-multiple" name="Friends" route="/friends" />
			</div>

			<div class="separator"></div>

			<div class="user-list">
				<div class="direct-messages">
					Direct Messages
					<Icon @click="openDM" class="new-dm-icon" icon="mdi:plus" />
				</div>
				<template v-for="(user, index) in reversedDms" :key="user.id.toString()">
					<User
						:user="user"
						@contextmenu.prevent="openContextMenu($event, user)"
						@click="handleUserClick(user)"
						:class="{ selected: user_id === user.id.toString() }"
					/>
					<div v-if="index < dmStore.dms.length - 1" class="user-separator"></div>
				</template>
			</div>
		</aside>
		<main>
			<router-view />
		</main>
		<ContextMenu
			:options="contextMenu.options"
			:x="contextMenu.x"
			:y="contextMenu.y"
			:show="contextMenu.show"
			@close="contextMenu.show = false"
			@select="handleContextAction"
			:min-width="260"
		/>
	</div>
</template>

<style scoped>
	.chats-view {
		display: grid;
		grid-template-columns: clamp(200px, 20%, 300px) 1fr;
		height: 100%;
		position: relative;
	}

	aside {
		border-right: 1px solid #303030;
		padding-top: 8px;
		position: relative;
	}

	.button-container {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.direct-messages {
		font-size: 14px;
		color: var(--text-muted);
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-inline: 8px;
		padding-bottom: 4px;
	}

	.direct-messages:has(.new-dm-icon:hover) {
		color: var(--text);
	}

	.separator {
		height: 1px;
		background-color: var(--border);
		margin: 8px 0px;
	}

	.user-list {
		display: flex;
		flex-direction: column;
		padding: 10px;
		padding-top: 4px;
		gap: 5px;
	}

	.user-list * {
		transition: background-color 0.3s;
	}

	.user-separator {
		height: 1px;
		background-color: var(--border);
		margin-left: 50px;
	}

	main {
		background-color: var(--bg);
		position: relative;
		height: 100%;
	}

	.selected {
		background-color: var(--bg-light);
	}

	.selected:hover {
		background-color: var(--bg-lighter);
	}

	.new-dm-icon {
		cursor: pointer;
	}
</style>
