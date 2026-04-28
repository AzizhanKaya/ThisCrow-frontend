<script setup lang="ts">
	import { Status } from '@/types';
	import { computed, ref } from 'vue';
	import { useMeStore } from '@/stores/me';
	import VoicePanel from './VoicePanel.vue';
	import { onClickOutside } from '@vueuse/core';
	import { useRouter } from 'vue-router';
	import { Icon } from '@iconify/vue';
	import { websocketService } from '@/services/websocket';
	import { getDefaultAvatar } from '@/utils/avatar';
	import { webrtcService } from '@/services/webrtc';
	import { useModalStore, ModalView } from '@/stores/modal';

	const meStore = useMeStore();
	const router = useRouter();

	const user = meStore.me!;

	const showStatusMenu = ref(false);

	const getStatus = computed(() => {
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
	});

	const changeStatus = (newStatus: Status) => {
		meStore.changeStatus(newStatus);
		showStatusMenu.value = false;
	};

	const statusContainer = ref(null);
	const userCardRef = ref(null);

	onClickOutside(statusContainer, () => {
		showStatusMenu.value = false;
	});

	onClickOutside(userCardRef, () => {
		showUserMenu.value = false;
	});

	const showUserMenu = ref(false);

	const handleUserCardClick = () => {
		showUserMenu.value = !showUserMenu.value;
	};

	const handleAction = async (action: string) => {
		if (action === 'logout') {
			websocketService.disconnect();
			await meStore.logOut();
			router.push({ name: 'login' });
		}

		if (action === 'profile') {
			useModalStore().openModal(ModalView.PROFILE_CARD, { user: meStore.me });
		}

		showUserMenu.value = false;
	};
</script>

<template>
	<div v-if="user" class="user-container">
		<VoicePanel />

		<div class="user-card" ref="userCardRef" @click="handleUserCardClick">
			<img
				class="avatar"
				:src="user.avatar || getDefaultAvatar(user.username)"
				:class="{ 'is-speaking': webrtcService.speakingUsers.has(user.id) }"
			/>

			<div class="names">
				<span class="name">{{ user.name }}</span>
				<span class="username">@{{ user.username }}</span>
			</div>

			<div ref="statusContainer" class="status-container" @click.stop="showStatusMenu = !showStatusMenu">
				<div class="status" :class="'status-' + getStatus"></div>

				<Transition name="fade">
					<div v-if="showStatusMenu" class="status-menu" @click.stop>
						<div v-for="status in Object.values(Status)" :key="status" class="status-option" @click="changeStatus(status)">
							<div class="status-indicator" :class="'status-' + status.toLowerCase()"></div>
							<span>{{ status }}</span>
						</div>
					</div>
				</Transition>
			</div>

			<Transition name="slide-up" mode="out-in">
				<div v-if="showUserMenu" class="user-menu" @click.stop>
					<button class="menu-item danger" @click="handleAction('logout')">
						<div class="item-left">
							<Icon icon="mdi:logout" class="item-icon" />
							<div class="item-text">
								<span class="label">Log Out</span>
							</div>
						</div>
					</button>
					<div class="menu-divider"></div>
					<button class="menu-item" @click="handleAction('profile')">
						<div class="item-left">
							<Icon icon="mdi:account" class="item-icon" />
							<div class="item-text">
								<span class="label">Profile</span>
							</div>
						</div>
					</button>
					<button class="menu-item" @click="handleAction('settings')">
						<div class="item-left">
							<Icon icon="mdi:cog" class="item-icon" />
							<div class="item-text">
								<span class="label">Settings</span>
							</div>
						</div>
					</button>
				</div>
			</Transition>
		</div>
	</div>
</template>

<style scoped>
	.user-container {
		position: absolute;
		bottom: 20px;
		left: 80px;
		width: calc(clamp(200px, (100% - 70px) * 0.2, 300px) - 20px);
		z-index: 30;
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.user-card {
		background-color: var(--bg);
		padding: 10px;
		border-radius: 10px;
		height: 70px;
		display: flex;
		align-items: center;
		gap: 10px;
		transition: background-color 0.2s ease;
		position: relative;
	}

	.user-card:hover {
		cursor: pointer;
		background-color: var(--bg-light);
	}

	.avatar {
		aspect-ratio: 1;
		height: 100%;
		border-radius: 50%;
		transition: box-shadow 0.2s ease;
	}

	.avatar.is-speaking {
		box-shadow:
			0 0 0 2px var(--success),
			0 0 12px var(--success);
	}

	.names {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		justify-content: center;
		min-width: 0;
		flex: 1;
	}

	.name {
		font-weight: bold;
		font-size: 1.2rem;
		color: var(--text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		width: 100%;
	}

	.username {
		font-size: 0.9em;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.status-container {
		margin-left: auto;
		margin-right: 10px;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}

	.status {
		height: 20px;
		aspect-ratio: 1;
		border-radius: 50%;
		border: 2px var(--bg) solid;
		transition: transform 0.2s ease;
	}

	.user-card:hover .status {
		border-color: var(--bg-light);
	}

	.status-container:hover .status {
		transform: scale(1.1);
	}

	.status-menu {
		position: absolute;
		bottom: 35px;
		background-color: var(--bg-darker);
		border-radius: 12px;
		padding: 8px;
		width: 140px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
		display: flex;
		flex-direction: column;
		gap: 4px;
		z-index: 100;
		border: 1px solid var(--border);
	}

	.status-option {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 12px;
		border-radius: 8px;
		color: var(--text);
		cursor: pointer;
		transition:
			background-color 0.2s,
			color 0.2s;
		font-weight: 500;
		font-size: 0.95rem;
	}

	.status-option:hover {
		background-color: var(--bg);
		color: var(--text);
	}

	.status-indicator {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.user-menu {
		position: absolute;
		bottom: calc(100% + 10px);
		left: 0;
		width: 100%;
		background-color: var(--bg-darker);
		border-radius: 12px;
		padding: 8px;
		display: flex;
		flex-direction: column;
		gap: 4px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
		z-index: 100;
		border: 1px solid var(--border);
	}

	.menu-divider {
		height: 1px;
		background-color: var(--border);
		margin: 4px 0;
	}

	.menu-item {
		background: none;
		border: none;
		color: var(--text);
		padding: 8px;
		text-align: left;
		cursor: pointer;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: flex-start;
		font-family: inherit;
		width: 100%;
		transition:
			background-color 0.2s,
			color 0.2s;
	}

	.item-left {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.item-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.label {
		font-size: 14px;
		font-weight: 500;
		color: var(--text);
	}

	.item-icon {
		font-size: 18px;
		flex-shrink: 0;
		color: var(--text);
	}

	.menu-item:hover {
		background-color: var(--bg);
	}

	.menu-item:hover .label,
	.menu-item:hover .item-icon {
		color: var(--text);
	}

	.menu-item.danger .label,
	.menu-item.danger .item-icon {
		color: var(--error);
	}

	.menu-item.danger:hover {
		background-color: var(--error);
	}

	.menu-item.danger:hover .label,
	.menu-item.danger:hover .item-icon {
		color: var(--text);
	}

	.slide-up-enter-active,
	.slide-up-leave-active {
		transition:
			transform 0.2s ease,
			opacity 0.2s ease;
		transform-origin: bottom;
	}

	.slide-up-enter-from,
	.slide-up-leave-to {
		transform: translate3d(0, 10px, 0);
		opacity: 0;
	}

	.fade-enter-active,
	.fade-leave-active {
		transition:
			opacity 0.2s ease,
			transform 0.2s ease;
	}

	.fade-enter-from,
	.fade-leave-to {
		opacity: 0;
		transform: translate3d(0, 10px, 0) scale(0.95);
	}
</style>
