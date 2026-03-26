<script setup lang="ts">
	import { Status } from '@/types';
	import { computed, ref } from 'vue';
	import { useMeStore } from '@/stores/me';
	import { useVoiceStore } from '@/stores/voice';
	import { onClickOutside } from '@vueuse/core';
	import { useRouter } from 'vue-router';
	import { Icon } from '@iconify/vue';
	import { websocketService } from '@/services/websocket';

	const meStore = useMeStore();
	const voiceStore = useVoiceStore();
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

	const handleAction = (action: string) => {
		if (action === 'logout') {
			websocketService.disconnect();
			meStore.logOut();
			router.push({ name: 'login' });
		}
		showUserMenu.value = false;
	};
</script>

<template>
	<div v-if="user" class="user-container">
		<!-- Voice Panel Wrapper -->
		<div v-if="voiceStore.voice_channel || voiceStore.voice_direct" class="voice-panel">
			<div class="voice-info">
				<div class="voice-connection">
					<Icon icon="mdi:connection" class="icon-green" />
					<span>RTC Connected</span>
				</div>
				<div class="voice-channel-name">
					#{{ voiceStore.voice_channel ? voiceStore.voice_channel.name : voiceStore.voice_direct?.name }}
				</div>
			</div>
			<div class="voice-actions">
				<button class="action-btn" :class="{ 'is-active': voiceStore.isMuted }" @click.stop="voiceStore.toggleMute()">
					<Icon :icon="voiceStore.isMuted ? 'mdi:microphone-off' : 'mdi:microphone'" />
				</button>
				<button class="action-btn" :class="{ 'is-active': voiceStore.isScreenSharing }" @click.stop="voiceStore.toggleScreen()">
					<Icon :icon="voiceStore.isScreenSharing ? 'mdi:monitor-share' : 'ic:round-stop-screen-share'" />
				</button>
				<button class="action-btn danger" @click.stop="voiceStore.leaveVoice()">
					<Icon icon="mdi:phone-hangup" />
				</button>
			</div>
		</div>

		<div class="user-card" ref="userCardRef" @click="handleUserCardClick">
			<img class="avatar" :src="user.avatar || '/default-avatar.png'" />

			<div class="names">
				<span class="name">{{ user.name }}</span>
				<span class="username">@{{ user.username }}</span>
			</div>

			<div ref="statusContainer" class="status-container" @click.stop="showStatusMenu = !showStatusMenu">
				<div class="status" :class="getStatus"></div>

				<Transition name="fade">
					<div v-if="showStatusMenu" class="status-menu" @click.stop>
						<div v-for="status in Object.values(Status)" :key="status" class="status-option" @click="changeStatus(status)">
							<div class="status-indicator" :class="status.toLowerCase()"></div>
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
		gap: 8px;
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
	}

	.names {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		justify-content: center;
	}

	.name {
		font-weight: bold;
		font-size: 1.2rem;
		color: #dbdbdb;
	}

	.username {
		font-size: 0.9em;
		color: #bebebe;
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
		border: 2px #333 solid;
		transition: transform 0.2s ease;
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
		border: 1px solid #333;
	}

	.status-option {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 12px;
		border-radius: 8px;
		color: #dbdbdb;
		cursor: pointer;
		transition:
			background-color 0.2s,
			color 0.2s;
		font-weight: 500;
		font-size: 0.95rem;
	}

	.status-option:hover {
		background-color: #333;
		color: #fff;
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
		color: #dbdbdb;
	}

	.item-icon {
		font-size: 18px;
		flex-shrink: 0;
		color: #dbdbdb;
	}

	.menu-item:hover {
		background-color: var(--bg);
	}

	.menu-item:hover .label,
	.menu-item:hover .item-icon {
		color: #fff;
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
		color: #fff;
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

	.online {
		background-color: #43b581;
	}
	.dnd {
		background-color: #f04747;
	}
	.idle {
		background-color: #e2e446;
	}
	.offline {
		background-color: #72767d;
	}

	.voice-panel {
		background-color: var(--bg-dark);
		border-radius: 10px;
		padding: 10px;
		border: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.voice-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.voice-connection {
		display: flex;
		align-items: center;
		gap: 6px;
		color: #43b581;
		font-weight: 600;
		font-size: 0.9rem;
	}

	.icon-green {
		color: #43b581;
	}

	.voice-channel-name {
		font-size: 0.85rem;
		color: #bebebe;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.voice-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin-top: 4px;
	}

	.action-btn {
		background: none;
		border: none;
		color: #bebebe;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 6px;
		border-radius: 6px;
		transition: all 0.2s;
		font-size: 1.1rem;
		flex: 1;
		background-color: var(--bg);
	}

	.action-btn:hover {
		color: #fff;
		background-color: #333;
	}

	.action-btn.is-active {
		color: var(--error);
	}

	.action-btn.danger {
		color: var(--error);
	}

	.action-btn.danger:hover {
		background-color: var(--error);
		color: #fff;
	}
</style>
