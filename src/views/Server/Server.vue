<script setup lang="ts">
	import { computed, watch, ref, onMounted, onUnmounted } from 'vue';
	import { useServerStore } from '@/stores/server';
	import MessageList from '@/components/Message/MessageList.vue';
	import MessageInput from '@/components/Message/MessageInput.vue';
	import { Icon } from '@iconify/vue';
	import { useModalStore } from '@/stores/modal';
	import { ModalView } from '@/stores/modal';
	import { ChannelType, MessageType, type Member, type Role, type id, type Server } from '@/types';
	import Channels from './Channels.vue';
	import Members from './Members.vue';
	import { useRoute } from 'vue-router';
	import { useAppStore } from '@/stores/app';
	import Voice from './Voice.vue';
	import ContextMenu, { type ContextMenuOption } from '@/components/ContextMenu.vue';

	const appStore = useAppStore();
	const serverStore = useServerStore();
	const modalStore = useModalStore();
	const route = useRoute();

	const server_id = computed(() => {
		return Number(route.params.serverId as string);
	});
	const server = $computed(() => serverStore.getServerById(server_id.value)!);

	const channel_id = ref<id | null>(null);
	const channel = $computed(() => server.channels?.get(channel_id.value ?? 0));

	watch(
		server_id,
		(newId, oldId, onCleanup) => {
			if (!newId || newId === 0) return;

			serverStore.subscribeToServer(newId);

			const unsubscribe = async () => serverStore.unsubscribeFromServer(newId);

			const removeHandler = appStore.onBeforeUnload(unsubscribe);

			onCleanup(async () => {
				removeHandler();
				await unsubscribe();
			});
		},
		{ immediate: true }
	);

	const serverMenu = ref({ show: false, x: 0, y: 0 });

	const serverMenuOptions: ContextMenuOption[] = [
		{ label: 'Server Info', action: 'server-info', icon: 'mdi:information-outline' },
		{ label: 'Invite Others', action: 'invite', icon: 'mdi:account-plus-outline' },
		{ divider: true },
		{ label: 'Settings', action: 'settings', icon: 'mdi:cog-outline' },
	];

	const openServerMenu = (event: MouseEvent) => {
		serverMenu.value = {
			show: true,
			x: event.clientX,
			y: event.clientY,
		};
	};

	const handleServerMenuSelect = (action: string) => {
		switch (action) {
			case 'server-info':
				break;
			case 'invite':
				modalStore.openModal(ModalView.INVITE, { server_id: server_id.value, server_name: server.name });
				break;
			case 'settings':
				break;
		}
	};
</script>

<template>
	<div class="server-view" v-if="server.channels !== undefined && server.members !== undefined && server.roles !== undefined">
		<div class="sidebar">
			<div class="server-header">
				<div class="server-info">
					<img :src="server.icon || '/default-server-icon.png'" alt="" />
					<span>{{ server.name }}</span>
				</div>
				<Icon @click="openServerMenu" icon="fluent:chevron-down-16-filled" />
			</div>

			<Channels v-model="channel_id" :server_id="server_id" v-model:channels="server.channels!" />
		</div>

		<div class="main-content">
			<div class="channel-header" v-if="channel">
				<h3>
					<Icon v-if="channel.type === ChannelType.Text" icon="glyphs:hash-bold" class="channel-icon hash" />
					<Icon v-else icon="mdi:volume-high" class="channel-icon voice-icon" />
					{{ channel.name }}
				</h3>
			</div>

			<MessageList v-if="channel?.type === ChannelType.Text" :messages="channel.messages || []" />
			<Voice v-else-if="channel?.type === ChannelType.Voice" :channel="channel" />

			<div v-if="channel?.type === ChannelType.Text">
				<MessageInput :to="channel_id!" :group_id="server_id" :type="MessageType.Group" />
				<div class="input-cover"></div>
			</div>
		</div>

		<Members :members="server.members!" />
		<ContextMenu
			:show="serverMenu.show"
			:x="serverMenu.x"
			:y="serverMenu.y"
			:options="serverMenuOptions"
			:min-width="180"
			@select="handleServerMenuSelect"
			@close="serverMenu.show = false"
		/>
	</div>
</template>

<style scoped>
	.server-view {
		display: grid;
		grid-template-columns: clamp(200px, 20%, 300px) 1fr 240px;
		height: 100%;
		width: 100%;
	}

	.sidebar {
		border-right: 1px solid var(--border);
		overflow: hidden;
		position: relative;
		display: flex;
		flex-direction: column;
	}

	.server-header {
		flex-shrink: 0;
		height: 50px;
		padding-right: 16px;
		padding-left: 12px;
		border-bottom: 1px solid var(--border);
		font-weight: 800;
		color: var(--text);
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.server-info {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.server-info img {
		width: 40px;
		height: 40px;
		border-radius: 10px;
		object-fit: cover;
		border: 1px solid var(--border);
	}

	.server-info span {
		font-size: 16px;
		font-weight: 800;
		color: var(--text);
	}

	.main-content {
		display: flex;
		flex-direction: column;
		background-color: var(--bg);
		position: relative;
		overflow: hidden;
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

	.channel-icon {
		font-size: 24px;
		margin-right: 8px;
	}

	.input-cover {
		position: absolute;
		bottom: 0;
		width: 100%;
		height: 30px;
	}
</style>
