<script setup lang="ts">
	import { type Channel, ChannelType } from '@/types';
	import { Icon } from '@iconify/vue';
	import { webrtcService } from '@/services/webrtc';
	import { getDefaultAvatar } from '@/utils/avatar';
	import { useWatchStore } from '@/stores/watch';

	const watchStore = useWatchStore();
	const props = defineProps<{
		channel: Channel;
		active: boolean;
	}>();

	const emit = defineEmits(['click']);
</script>

<template>
	<div class="channel-wrapper">
		<div class="channel-item" :class="{ active: active }" @click="emit('click', channel)">
			<Icon v-if="channel.type === ChannelType.Text" icon="octicon:hash-16" class="channel-icon hash" />
			<Icon v-else icon="mdi:volume-high" class="channel-icon voice-icon" />
			<span class="channel-name">{{ channel.name }}</span>
		</div>

		<div v-if="channel.users && channel.users.size > 0" class="channel-users">
			<div v-for="user in channel.users" :key="String(user.id)" class="channel-user">
				<img
					:src="user.avatar || getDefaultAvatar(user.username)"
					alt="avatar"
					class="user-avatar"
					:class="{ 'is-speaking': webrtcService.speakingUsers.has(user.id) }"
				/>
				<span class="user-name">{{ user.name }}</span>
				<Icon v-if="channel.watch_party?.host === user.id" icon="tdesign:film-filled" class="watch-party-icon" />
				<Icon v-else-if="channel.watch_party?.users.includes(user.id)" icon="clarity:film-strip-solid" class="watch-party-icon" />
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

	.watch-party-icon {
		margin-left: auto;
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
