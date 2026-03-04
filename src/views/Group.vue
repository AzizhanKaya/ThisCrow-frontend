<script setup lang="ts">
	import { computed, onBeforeUnmount, watch, ref } from 'vue';
	import { useRoute } from 'vue-router';
	import { useServerStore } from '@/stores/server';
	import { useUserStore } from '@/stores/user';
	import { useMeStore } from '@/stores/me';
	import MessageList from '@/components/Message/MessageList.vue';
	import MessageInput from '@/components/Message/MessageInput.vue';
	import { Icon } from '@iconify/vue';
	import { ChannelType, MessageType, Status, type Message, type User, type Member, type Role } from '@/types';

	const route = useRoute();
	const serverStore = useServerStore();
	const userStore = useUserStore();
	const meStore = useMeStore();

	const groupId = computed(() => {
		const id = route.params.groupId;
		console.log(id);
		return BigInt(id as string);
	});

	const server = computed(
		() =>
			serverStore.getServerById(groupId.value) || {
				id: groupId.value,
				version: 1n,
				name: 'Mocked Server',
				icon: 'https://api.dicebear.com/7.x/identicon/svg?seed=server',
				channels: [],
				members: [],
				roles: [],
			}
	);

	const mockRoles: Role[] = [
		{ id: 1n, name: 'Admin', color: '#ff0000' },
		{ id: 2n, name: 'Moderator', color: '#00ff00' },
		{ id: 3n, name: 'Member', color: '#0000ff' },
	];

	const defaultRole: Role = { id: 0n, name: 'Online', color: '#999999' };

	const channels = computed(() =>
		server.value.channels && server.value.channels.length > 0
			? server.value.channels
			: [
					{ id: 1n, name: 'general', type: ChannelType.Text },
					{ id: 2n, name: 'memes', type: ChannelType.Text },
					{ id: 3n, name: 'General Voice', type: ChannelType.Voice },
					{ id: 4n, name: 'Gaming', type: ChannelType.Voice },
				]
	);

	const textChannels = computed(() => channels.value.filter((c) => c.type === ChannelType.Text));
	const voiceChannels = computed(() => channels.value.filter((c) => c.type === ChannelType.Voice));

	const members = computed(() =>
		server.value.members && server.value.members.length > 0
			? server.value.members
			: ([
					{
						user: {
							id: 1n,
							version: 1n,
							name: 'Alice',
							username: 'alice',
							status: Status.Online,
							avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice',
						},
						roles: [mockRoles[0]],
					},
					{
						user: {
							id: 2n,
							version: 1n,
							name: 'Bob',
							username: 'bob',
							status: Status.Idle,
							avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob',
						},
						roles: [mockRoles[1]],
					},
					{
						user: {
							id: 3n,
							version: 1n,
							name: 'Charlie',
							username: 'charlie',
							status: Status.Dnd,
							avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Charlie',
						},
						roles: [mockRoles[2]],
					},
					{
						user: {
							id: 4n,
							version: 1n,
							name: 'Dave',
							username: 'dave',
							status: Status.Offline,
							avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Dave',
						},
						roles: [],
					},
					{
						user: {
							id: 5n,
							version: 1n,
							name: 'Eve',
							username: 'eve',
							status: Status.Online,
							avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Eve',
						},
						roles: [],
					},
				] as Member[])
	);
	const roles = computed(() => (server.value.roles && server.value.roles.length > 0 ? server.value.roles : mockRoles));

	const localSelectedChannelId = ref<bigint | null>(null);
	const selectedChannelId = computed(() => serverStore.selectedChannel || localSelectedChannelId.value || channels.value?.[0].id);
	const selectedChannel = computed(() => channels.value?.find((c) => c.id === selectedChannelId.value));

	const channelMessages = computed(() => {
		if (!selectedChannelId.value) return [];
		return serverStore.getChannelMessages(selectedChannelId.value);
	});

	watch(
		groupId,
		(newId, oldId, onCleanup) => {
			if (!newId || newId === 0n) return;

			serverStore.subscribeToServer(newId);

			onCleanup(() => {
				serverStore.unsubscribeFromServer(newId);
			});
		},
		{ immediate: true }
	);

	const selectChannel = (channelId: bigint) => {
		serverStore.selectChannel(channelId);
		localSelectedChannelId.value = channelId;
	};

	const membersByRole = computed(() => {
		const res: Record<string, { role: any; members: Member[] }> = {};

		members.value?.forEach((member) => {
			let role = defaultRole;
			if (member.roles && member.roles.length > 0) {
				role = member.roles[0];
			} else if (roles.value?.length > 0) {
				role = roles.value[0] || defaultRole;
			}

			if (!res[role.id.toString()]) {
				res[role.id.toString()] = { role, members: [] };
			}
			res[role.id.toString()].members.push(member);
		});
		return res;
	});
</script>

<template>
	<div class="group-view">
		<!-- Channels -->
		<div class="sidebar">
			<div class="server-header">
				<img :src="server.icon" alt="" />
				<h3>{{ server.name }}</h3>
			</div>
			<div class="channel-list">
				<div class="category" v-if="textChannels">
					<div class="category-title">
						<Icon icon="mdi:chevron-down" class="chevron" />
						<span>TEXT CHANNELS</span>
					</div>
					<div
						v-for="channel in textChannels"
						:key="channel.id.toString()"
						class="channel-item"
						:class="{ active: selectedChannelId === channel.id }"
						@click="selectChannel(channel.id)"
					>
						<Icon icon="lucide:hash" class="channel-icon hash" />
						<span class="channel-name">{{ channel.name }}</span>
					</div>
				</div>

				<div class="category" v-if="voiceChannels">
					<div class="category-title">
						<Icon icon="mdi:chevron-down" class="chevron" />
						<span>VOICE CHANNELS</span>
					</div>
					<div
						v-for="channel in voiceChannels"
						:key="channel.id.toString()"
						class="channel-item"
						:class="{ active: selectedChannelId === channel.id }"
						@click="selectChannel(channel.id)"
					>
						<Icon icon="mdi:volume-high" class="channel-icon voice-icon" />
						<span class="channel-name">{{ channel.name }}</span>
					</div>
				</div>
			</div>
		</div>

		<!-- Messages -->
		<div class="main-content">
			<div class="channel-header" v-if="selectedChannel">
				<h3>
					<Icon v-if="selectedChannel.type === ChannelType.Text" icon="lucide:hash" class="channel-icon hash nav-icon" />
					<Icon v-else icon="mdi:volume-high" class="channel-icon voice-icon nav-icon" />
					{{ selectedChannel.name }}
				</h3>
			</div>

			<div class="messages-area" v-if="selectedChannel && selectedChannel.type === ChannelType.Text">
				<MessageList :messages="channelMessages" />
			</div>
			<div class="voice-area" v-else-if="selectedChannel && selectedChannel.type === ChannelType.Voice">
				<div class="voice-info">Voice Call Info / Connections would go here.</div>
			</div>
			<div class="no-channel" v-else>Select a channel from the left menu.</div>

			<div v-if="selectedChannel && selectedChannel.type === ChannelType.Text">
				<MessageInput :to="selectedChannelId!" :group_id="groupId" :type="MessageType.Group" />
				<div class="input-cover"></div>
			</div>
		</div>

		<!-- Members -->
		<div class="rightbar">
			<div class="member-group" v-for="(group, roleId) in membersByRole" :key="roleId">
				<h4>{{ group.role.name }} - {{ group.members.length }}</h4>
				<div class="member-item" v-for="member in group.members" :key="member.user.id.toString()">
					<img :src="member.user.avatar || '/default-avatar.png'" class="avatar" />
					<span class="member-name">{{ member.user.name || member.user.username }}</span>
				</div>
			</div>
		</div>
	</div>
</template>

<style scoped>
	.group-view {
		display: grid;
		grid-template-columns: clamp(200px, 20%, 300px) 1fr 240px;
		height: 100%;
		width: 100%;
	}

	.sidebar {
		border-right: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		position: relative;
	}

	.server-header {
		height: 50px;
		padding: 0 16px;
		border-bottom: 1px solid var(--border);
		font-weight: 800;
		color: var(--text);
		display: flex;
		align-items: center;
	}

	.channel-list {
		flex: 1;
		overflow-y: auto;
		padding: 16px 8px;
	}

	.category {
		margin-bottom: 16px;
	}

	.category-title {
		display: flex;
		align-items: center;
		padding: 4px 8px;
		color: var(--text-muted);
		font-size: 0.75rem;
		font-weight: 700;
		cursor: pointer;
		margin-bottom: 2px;
	}

	.category-title:hover {
		color: var(--text);
	}

	.chevron {
		margin-right: 4px;
		font-size: 1rem;
	}

	.channel-item {
		padding: 6px 8px;
		border-radius: 4px;
		cursor: pointer;
		margin-bottom: 2px;
		display: flex;
		align-items: center;
		color: var(--text-muted);
		transition:
			background-color 0.15s ease,
			color 0.15s ease;
	}

	.channel-item:hover {
		background-color: #303030;
		color: var(--text);
	}

	.channel-item.active {
		background-color: #535353;
		color: var(--text);
	}

	.channel-item.active:hover {
		background-color: #666666;
	}

	.hash,
	.voice-icon {
		margin-right: 5px;
		font-size: 1.1rem;
		color: var(--text-muted);
	}

	.channel-item.active .hash,
	.channel-item.active .voice-icon {
		color: var(--text);
	}

	.main-content {
		display: flex;
		flex-direction: column;
		background-color: var(--bg);
		position: relative;
	}

	.channel-header {
		height: 50px;
		border-bottom: 1px solid var(--border);
		padding: 0 16px;
		background-color: var(--bg-dark);
		font-weight: bold;
		color: var(--text);
		display: flex;
		align-items: center;
	}

	.channel-header h3 {
		display: flex;
		align-items: center;
		font-size: 1.1rem;
		margin: 0;
	}

	.nav-icon {
		margin-right: 8px;
		font-size: 1.4rem;
	}

	.messages-area {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		padding-bottom: 80px;
	}

	.voice-area,
	.no-channel {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-muted);
		font-size: 1.1rem;
	}

	.input-cover {
		position: absolute;
		bottom: 0;
		width: 100%;
		height: 30px;
	}

	.rightbar {
		border-left: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		padding: 16px 8px;
		overflow-y: auto;
	}

	.member-group h4 {
		text-transform: uppercase;
		font-size: 12px;
		font-weight: 600;
		color: var(--text-muted);
		margin-bottom: 8px;
		margin-top: 16px;
		padding-left: 8px;
	}

	.member-group:first-child h4 {
		margin-top: 0;
	}

	.member-item {
		display: flex;
		align-items: center;
		padding: 6px 8px;
		border-radius: 4px;
		cursor: pointer;
		transition: background-color 0.1s ease;
	}

	.member-item:hover {
		background-color: var(--bg);
	}

	.avatar {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		margin-right: 12px;
		background-color: var(--bg);
		object-fit: cover;
	}

	.member-name {
		color: var(--text-muted);
		font-weight: 500;
	}

	.member-item:hover .member-name {
		color: var(--text);
	}
</style>
