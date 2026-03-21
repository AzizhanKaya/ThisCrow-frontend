<script setup lang="ts">
	import { type Channel, ChannelType } from '@/types';
	import { Icon } from '@iconify/vue';

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
				<img v-if="user.avatar" :src="user.avatar" alt="avatar" class="user-avatar" />
				<div v-else class="user-avatar-placeholder">
					<Icon icon="mdi:account" />
				</div>
				<span class="user-name">{{ user.name || user.username }}</span>
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
	}

	.user-avatar-placeholder {
		background-color: rgba(79, 84, 92, 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 14px;
		color: var(--text-muted);
	}

	.user-name {
		font-size: 14px;
		font-weight: 400;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
