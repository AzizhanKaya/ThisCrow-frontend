<script setup lang="ts">
	import type { PropType } from 'vue';
	import type { Server } from '@/types';
	import { useRoute, useRouter } from 'vue-router';
	import { useContextMenuStore } from '@/stores/contextMenu';
	import { useModalStore, ModalView } from '@/stores/modal';
	import { useServerStore } from '@/stores/server';
	import { useErrorStore } from '@/stores/error';
	import type { ContextMenuOption } from '@/components/ContextMenu.vue';

	const props = defineProps({
		server: {
			type: Object as PropType<Server>,
			required: true,
		},
	});

	const router = useRouter();
	const route = useRoute();
	const contextMenuStore = useContextMenuStore();
	const modalStore = useModalStore();
	const serverStore = useServerStore();
	const errorStore = useErrorStore();

	const onClick = () => {
		router.push({ name: 'server', params: { serverId: props.server.id.toString() } });
	};

	const openContextMenu = (event: MouseEvent) => {
		const options: ContextMenuOption[] = [
			{ label: 'Server Info', action: 'server-info', icon: 'mdi:information-outline' },
			{ divider: true },
			{ label: 'Leave Server', action: 'leave', icon: 'mdi:logout', variant: 'danger' },
		];

		contextMenuStore.open({
			e: event,
			options,
			minWidth: 180,
			zIndex: 1000,
			onSelect: (action) => {
				switch (action) {
					case 'server-info':
						modalStore.openModal(ModalView.SERVER_INFO, { server_id: props.server.id });
						break;
					case 'leave':
						modalStore.openModal(ModalView.CONFIRM, {
							icon: 'mdi:logout',
							title: `Leave ${props.server.name}`,
							text: `Are you sure you want to leave ${props.server.name}? You will need a new invite to rejoin.`,
							command: async () => {
								await serverStore
									.leaveServer(props.server.id)
									.catch((e) => errorStore.pushFrom(e, 'Failed to leave server'));
							},
						});
						break;
				}
			},
		});
	};
</script>

<template>
	<div
		class="server"
		@click="onClick"
		@contextmenu.prevent="openContextMenu"
		:class="{ 'is-active': route.params.serverId === server.id.toString() }"
	>
		<div class="server-indicator"></div>
		<div class="server-image">
			<img :src="server.icon || '/default-server-icon.png'" />
		</div>
	</div>
</template>

<style scoped>
	.server {
		aspect-ratio: 1;
		width: 100%;
		padding: 2px;
		cursor: pointer;
		position: relative;
		box-sizing: border-box;
	}

	.server-indicator {
		position: absolute;
		background-color: white;
		top: 50%;
		left: -20px;
		transform: translateY(-50%);
		width: 8px;
		height: 0;
		border-radius: 0 4px 4px 0;
		transition: height 0.3s ease;
		pointer-events: none;
		z-index: 1;
		transition:
			height 0.3s ease,
			left 0.3s ease;
	}
	.server.has-unread .server-indicator {
		height: 8px;
	}

	.server:hover .server-indicator {
		height: 15px;
		left: -15px;
	}

	.server.is-active .server-indicator {
		height: 20px;
		left: -15px;
	}

	.server-image {
		width: 100%;
		height: 100%;
		background-color: var(--bg-darker, #36393f);
		overflow: hidden;
		border-radius: 50%;

		transition:
			border-radius 0.3s ease,
			background-color 0.3s ease;
	}

	.server:hover .server-image,
	.server.is-active .server-image {
		border-radius: 16px;
	}

	.server-image > img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
</style>
