<script setup lang="ts">
	import { type Channel, ChannelType, type id, type User } from '@/types';
	import { Icon } from '@iconify/vue';
	import { webrtcService } from '@/services/webrtc';
	import { getDefaultAvatar } from '@/utils/avatar';
	import { useModalStore, ModalView } from '@/stores/modal';
	import { useProfileCardStore } from '@/stores/profileCard';
	import { useServerStore } from '@/stores/server';
	import { useVoiceStore } from '@/stores/voice';
	import { useWatchPartyCardStore } from '@/stores/watchPartyCard';
	import { can } from '@/utils/perms';
	import { computed, onBeforeUnmount } from 'vue';

	const modalStore = useModalStore();
	const profileCardStore = useProfileCardStore();
	const serverStore = useServerStore();
	const voiceStore = useVoiceStore();
	const watchPartyCardStore = useWatchPartyCardStore();

	const props = defineProps<{
		channel: Channel;
		active: boolean;
		server_id: id;
	}>();

	const server = computed(() => serverStore.getServerById(props.server_id));
	const p = can(server, () => props.channel);

	const emit = defineEmits(['click']);

	function openSettings(e: MouseEvent) {
		e.stopPropagation();
		modalStore.openModal(ModalView.CHANNEL_SETTINGS, {
			server_id: props.server_id,
			channel_id: props.channel.id,
		});
	}

	function openProfileCard(e: MouseEvent, user: User) {
		const target = e.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();

		const server = serverStore.servers.get(props.server_id);
		const member = server?.members?.get(user.id);

		profileCardStore.open({
			target,
			x: rect.right + 10,
			y: rect.top,
			user: user,
			roles: member?.roles,
		});
	}

	let hoverTimer: ReturnType<typeof setTimeout> | undefined;

	function onChannelHover(e: MouseEvent) {
		if (!props.channel.watch_party) return;
		clearTimeout(hoverTimer);
		const target = e.currentTarget as HTMLElement;
		hoverTimer = setTimeout(() => {
			const rect = target.getBoundingClientRect();
			watchPartyCardStore.open({
				target,
				x: rect.right + 12,
				y: rect.top,
				server_id: props.server_id,
				channel_id: props.channel.id,
			});
		}, 400);
	}

	function onChannelLeave() {
		clearTimeout(hoverTimer);
		hoverTimer = undefined;
		if (watchPartyCardStore.channel_id === props.channel.id) {
			watchPartyCardStore.close();
		}
	}

	onBeforeUnmount(() => {
		clearTimeout(hoverTimer);
	});
</script>

<template>
	<div class="channel-wrapper">
		<div
			class="channel-item"
			:class="{ active: active, 'no-connect': channel.type === ChannelType.Voice && !p.connect }"
			:title="channel.type === ChannelType.Voice && !p.connect ? 'You cannot connect to this channel' : ''"
			@click="emit('click', channel)"
			@mouseenter="onChannelHover($event)"
			@mouseleave="onChannelLeave()"
		>
			<Icon v-if="channel.type === ChannelType.Text" icon="octicon:hash-16" class="channel-icon hash" />
			<Icon v-else icon="mdi:volume-high" class="channel-icon voice-icon" />
			<span class="channel-name">{{ channel.name }}</span>
			<button v-if="p.manageChannels" class="settings-btn" @click="openSettings" title="Channel settings">
				<Icon icon="mdi:cog" />
			</button>
		</div>

		<div v-if="channel.users && channel.users.size > 0" class="channel-users">
			<div v-for="user in channel.users" :key="String(user.id)" class="channel-user" @click.stop="openProfileCard($event, user)">
				<img
					:src="user.avatar || getDefaultAvatar(user.username)"
					alt="avatar"
					class="user-avatar"
					:class="{ 'is-speaking': webrtcService.speakingUsers.has(user.id) }"
				/>
				<span class="user-name">{{ user.name }}</span>
				<div class="user-status-icons">
					<Icon v-if="channel.watch_party?.host === user.id" icon="tdesign:film-filled" class="watch-party-icon" />
					<Icon v-else-if="channel.watch_party?.users.includes(user.id)" icon="clarity:film-strip-solid" class="watch-party-icon" />
					<Icon v-if="voiceStore.userStates.get(user.id)?.muted" icon="mdi:microphone-off" class="voice-status-icon" />
					<Icon v-if="voiceStore.userStates.get(user.id)?.deafened" icon="mdi:headphones-off" class="voice-status-icon" />
				</div>
			</div>
		</div>
	</div>
</template>

<style scoped>
	.channel-wrapper {
		display: flex;
		flex-direction: column;
		width: 100%;
	}

	.channel-item {
		position: relative;
		display: flex;
		align-items: center;
		margin-bottom: 2px;
		padding: 6px 8px;
		border-radius: 4px;
		color: var(--text-muted);
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			color 0.15s ease;
		user-select: none;
	}

	.channel-name {
		font-size: 16px;
		font-weight: 500;
		white-space: nowrap;
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.settings-btn {
		position: absolute;
		right: 8px;
		top: 50%;
		transform: translateY(-50%);
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2px;
		font-size: 1rem;
		opacity: 0;
		pointer-events: none;
		transition:
			color 0.15s ease,
			opacity 0.15s ease;
	}

	.channel-item:hover .settings-btn {
		opacity: 1;
		pointer-events: auto;
	}

	.settings-btn:hover {
		color: var(--text);
	}

	.channel-icon {
		margin-right: 5px;
		font-size: 1rem;
		color: var(--text-muted);
	}

	.channel-item.active {
		background-color: var(--bg-lighter);
		color: var(--text);
	}

	.channel-item.active .channel-icon {
		color: var(--text);
	}

	.channel-item.no-connect {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.channel-users {
		display: flex;
		flex-direction: column;
		padding-left: 26px;
		margin-bottom: 4px;
		gap: 2px;
	}

	.channel-user {
		display: flex;
		align-items: center;
		padding: 4px 8px;
		border-radius: 4px;
		color: var(--text-muted);
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			color 0.15s ease;
	}

	.channel-user:hover {
		background-color: var(--bg-lighter);
		color: var(--text);
	}

	.user-avatar,
	.user-avatar-placeholder {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		margin-right: 8px;
		object-fit: cover;
		flex-shrink: 0;
		transition: box-shadow 0.2s ease;
	}

	.user-avatar-placeholder {
		background-color: rgba(79, 84, 92, 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 14px;
		color: var(--text-muted);
	}

	.is-speaking {
		box-shadow:
			0 0 0 2px var(--success),
			0 0 8px var(--success);
		z-index: 2;
	}

	.user-name {
		font-size: 14px;
		font-weight: 400;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.user-status-icons {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.watch-party-icon {
		font-size: 0.95rem;
	}

	.voice-status-icon {
		font-size: 0.95rem;
		color: var(--text-muted);
	}

	.watch-party-btn {
		margin-left: auto;
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		display: none;
		align-items: center;
		justify-content: center;
		padding: 2px;
		transition: color 0.2s;
		height: 100%;
	}

	.channel-item:hover .watch-party-btn {
		display: flex;
	}

	.watch-party-btn:hover {
		color: var(--text);
	}

	.watch-party-btn svg {
		font-size: 1.1rem;
	}
</style>
