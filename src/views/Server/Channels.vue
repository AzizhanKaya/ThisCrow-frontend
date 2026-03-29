<script setup lang="ts">
	import { computed, ref, watch, onUnmounted } from 'vue';
	import { Icon } from '@iconify/vue';
	import ContextMenu from '@/components/ContextMenu.vue';
	import type { ContextMenuOption } from '@/components/ContextMenu.vue';
	import { useModalStore, ModalView } from '@/stores/modal';
	import { ChannelType, EventType, MessageType, type Channel, type id, type Message, type Event, AckType } from '@/types';
	import draggable from 'vuedraggable';
	import { websocketService } from '@/services/websocket';
	import ChannelComponent from '@/components/Server/Channel.vue';
	import { webrtcService } from '@/services/webrtc';
	import { useMeStore } from '@/stores/me';
	import { generate_uid } from '@/utils/uid';
	import { useVoiceStore } from '@/stores/voice';
	import { useRoute, useRouter } from 'vue-router';

	// Props & Models
	const props = defineProps<{ server_id: id }>();
	const channels = defineModel<Map<id, Channel>>('channels', { required: true });

	// Stores
	const modalStore = useModalStore();
	const router = useRouter();
	const route = useRoute();

	// State
	const isDragging = ref(false);
	const channel_id = computed(() => {
		return route.query.channel ? Number(route.query.channel) : null;
	});

	const dragOverCategory = ref<string | null>(null);
	const channelContextMenu = ref({ show: false, x: 0, y: 0 });
	const collapsedCategories = ref(new Set<string | null>());
	const categories = ref<{ title: string | null; channels: Channel[] }[]>([]);

	watch(
		channels,
		() => {
			if (isDragging.value) return;

			const grouped = new Map<string | null, Channel[]>();
			Array.from(channels.value.values())
				.sort((a, b) => b.position - a.position)
				.forEach((c) => {
					const title = c.title ?? null;
					if (!grouped.has(title)) grouped.set(title, []);
					grouped.get(title)!.push(c);
				});

			categories.value = Array.from(grouped.entries()).map(([title, channels]) => ({ title, channels }));
		},
		{ deep: true, immediate: true }
	);

	function onDragEnd() {
		let currentMaxPosition = channels.value.size;

		categories.value.forEach((category) => {
			category.channels.forEach((channel) => {
				const target = channels.value.get(channel.id);
				if (!target) return;

				const newPos = currentMaxPosition--;
				let needsUpdate = false;

				if (target.title !== category.title) {
					target.title = category.title;
					needsUpdate = true;
				}

				if (target.position !== newPos) {
					target.position = newPos;
					needsUpdate = true;
				}

				if (needsUpdate) {
					sendChannelUpdate(target.id, target.title, target.position);
				}
			});
		});

		isDragging.value = false;
		dragOverCategory.value = null;
	}

	function sendChannelUpdate(channelId: id, newTitle: string | null, newPosition: number) {
		const meStore = useMeStore();
		websocketService.sendMessage({
			id: generate_uid(meStore.me!.id),
			from: meStore.me!.id,
			to: channelId,
			group_id: props.server_id,
			type: MessageType.InfoGroup,
			data: {
				event: EventType.UpdateChannel,
				payload: { title: newTitle ?? undefined, position: newPosition },
			},
		} as Message<Event>);
	}

	function onCategoryDragLeave(event: DragEvent, categoryTitle: string | null) {
		if (!isDragging.value) return;

		const currentTarget = event.currentTarget as HTMLElement;
		const relatedTarget = event.relatedTarget as Node | null;

		if (!currentTarget.contains(relatedTarget)) {
			if (dragOverCategory.value === categoryTitle) dragOverCategory.value = null;
		}
	}

	const channelSidebarOptions: ContextMenuOption[] = [
		{ label: 'Create Channel', action: 'create-channel', icon: 'octicon:hash-16' },
		{ label: 'Create Category', action: 'create-category', icon: 'lucide:folder-plus' },
	];

	function onContextMenu(event: MouseEvent) {
		if ((event.target as HTMLElement).closest('.channel-item, .category-title')) return;
		event.preventDefault();
		channelContextMenu.value = { show: true, x: event.clientX, y: event.clientY };
	}

	function onMenuSelect(action: string) {
		const view = action === 'create-channel' ? ModalView.CREATE_CHANNEL : ModalView.CREATE_CATEGORY;
		modalStore.openModal(view, { server_id: props.server_id });
	}

	function toggleCategory(title: string | null) {
		collapsedCategories.value.has(title) ? collapsedCategories.value.delete(title) : collapsedCategories.value.add(title);
	}

	async function selectChannel(channel: Channel) {
		router.push({
			name: 'server',
			params: { serverId: props.server_id, channelId: channel.id },
		});

		if (channel.type === ChannelType.Voice) {
			const voiceStore = useVoiceStore();
			voiceStore.joinVoice(channel, props.server_id);
		}
		if (channel.type === ChannelType.Text) {
		}
	}
</script>

<template>
	<div class="channel-list" :class="{ 'is-dragging': isDragging }" @contextmenu="onContextMenu">
		<draggable
			v-model="categories"
			group="categories"
			:item-key="(cat: any) => cat.title || 'uncategorized'"
			handle=".category-title"
			ghost-class="ghost-category"
			drag-class="drag-category"
			:animation="200"
			:force-fallback="true"
			:fallback-class="'drag-category'"
			:delay="200"
			:delay-on-touch-only="true"
			@start="isDragging = true"
			@end="onDragEnd"
		>
			<template #item="{ element: category }">
				<div
					class="category"
					:class="{ 'is-drag-over': isDragging && category.title !== null && dragOverCategory === category.title }"
					@dragenter.prevent="dragOverCategory = category.title"
					@dragleave.prevent="onCategoryDragLeave($event, category.title)"
					@dragover.prevent="dragOverCategory = category.title"
					@drop="dragOverCategory = null"
				>
					<div class="category-title" v-if="category.title" @click="toggleCategory(category.title)">
						<Icon :icon="collapsedCategories.has(category.title) ? 'mdi:chevron-right' : 'mdi:chevron-down'" class="chevron" />
						<span>{{ category.title.toUpperCase() }}</span>
						<Icon
							icon="mdi:plus"
							class="add-icon"
							@click.stop="modalStore.openModal(ModalView.CREATE_CHANNEL, { server_id: props.server_id })"
						/>
					</div>

					<draggable
						v-show="!collapsedCategories.has(category.title)"
						:list="category.channels"
						group="channels"
						item-key="id"
						class="draggable-zone"
						ghost-class="ghost-line"
						chosen-class="chosen"
						drag-class="drag"
						:animation="200"
						:force-fallback="true"
						:fallback-class="'drag'"
						:fallback-tolerance="5"
						:delay="200"
						:delay-on-touch-only="true"
						@start="isDragging = true"
						@end="onDragEnd"
					>
						<template #item="{ element: channel }">
							<ChannelComponent :channel="channel" :active="channel_id === channel.id" @click="selectChannel" />
						</template>
					</draggable>
				</div>
			</template>
		</draggable>
	</div>

	<ContextMenu
		:show="channelContextMenu.show"
		:x="channelContextMenu.x"
		:y="channelContextMenu.y"
		:options="channelSidebarOptions"
		@select="onMenuSelect"
		@close="channelContextMenu.show = false"
		:min-width="180"
	/>
</template>

<style scoped>
	.channel-list {
		flex: 1;
		overflow-y: auto;
		padding: 16px 8px 100px 8px;
	}

	.category {
		margin-bottom: 8px;
		border-radius: 4px;
		transition: background-color 0.15s ease;
	}

	.category.is-drag-over {
		background-color: rgba(79, 84, 92, 0.16);
	}

	.category-title {
		display: flex;
		align-items: center;
		margin-bottom: 2px;
		padding: 4px 0;
		color: var(--text-muted);
		font-size: 0.75rem;
		font-weight: 700;
		cursor: pointer;
		user-select: none;
	}

	.category-title:active {
		cursor: grabbing;
	}

	.chevron {
		margin-right: 4px;
		font-size: 1rem;
		cursor: pointer;
	}

	.add-icon {
		margin-left: auto;
		cursor: pointer;
	}

	.draggable-zone {
		min-height: 10px;
		padding: 0 4px;
	}

	.channel-list.is-dragging,
	.channel-list.is-dragging * {
		cursor: grabbing !important;
	}

	.channel-list.is-dragging .category-title:hover {
		color: var(--text-muted);
	}

	.ghost-category {
		background-color: var(--bg-lighter);
		border-radius: 4px;
		opacity: 0.4;
	}

	.drag-category {
		width: 240px !important;
		box-sizing: border-box !important;
		border-radius: 4px !important;
		opacity: 0.9 !important;
		background-color: var(--bg) !important;
		box-shadow: 0 8px 15px rgba(0, 0, 0, 0.4) !important;
	}

	.drag {
		width: 240px !important;
		box-sizing: border-box !important;
		background-color: var(--bg-lighter) !important;
		box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3) !important;
		border-radius: 4px !important;
		opacity: 0.9 !important;
	}

	.channel-list:not(.is-dragging) :deep(.channel-item:hover) {
		background-color: var(--bg);
		color: var(--text);
	}

	.channel-list:not(.is-dragging) :deep(.channel-item.active:hover) {
		background-color: var(--bg-lightest);
	}

	:deep(.channel-wrapper.ghost-line) {
		position: relative !important;
		height: 30px !important;
		min-height: 0 !important;
		margin: 0 !important;
		padding: 0 !important;
		background: transparent !important;
		border: none !important;
		overflow: visible !important;
		opacity: 1 !important;
	}

	:deep(.channel-wrapper.ghost-line::before) {
		content: '';
		position: absolute;
		top: calc(50% - 2px);
		left: 0;
		right: 0;
		height: 4px;
		background-color: var(--color-lightest);
		border-radius: 2px;
		z-index: 10;
	}

	:deep(.channel-wrapper.ghost-line > *) {
		display: none !important;
	}
</style>
