<script setup lang="ts">
	import Server from '@/components/Server/ServerIcon.vue';
	import { useServerStore } from '@/stores/server';
	import CrowIcon from '@/components/CrowIcon.vue';
	import { computed, ref, watch } from 'vue';
	import ServerAdd from '@/components/Server/ServerAdd.vue';
	import draggable from 'vuedraggable';
	import type { Server as ServerType } from '@/types';

	const serverStore = useServerStore();

	const isDragging = ref(false);
	const serverList = ref<ServerType[]>([]);

	watch(
		() =>
			Array.from(serverStore.servers.values())
				.map((s) => `${s.id}:${s.position}`)
				.join(','),
		() => {
			if (isDragging.value) return;
			serverList.value = Array.from(serverStore.servers.values()).sort((a, b) => b.position - a.position);
		},
		{ immediate: true }
	);

	const hasServers = computed(() => serverList.value.length > 0);

	function onDragEnd() {
		isDragging.value = false;
	}

	function onChange(evt: any) {
		if (!evt.moved) return;
		const { element, newIndex } = evt.moved;
		serverStore.moveServer(element.id, serverList.value.length - newIndex);
	}
</script>

<template>
	<div class="server-list">
		<CrowIcon />
		<div v-if="hasServers" class="separator"></div>
		<draggable
			v-model="serverList"
			item-key="id"
			tag="div"
			class="draggable-zone"
			ghost-class="ghost-server"
			drag-class="drag-server"
			:animation="200"
			:force-fallback="true"
			:fallback-class="'drag-server'"
			:fallback-tolerance="5"
			:delay="200"
			:delay-on-touch-only="true"
			@start="isDragging = true"
			@end="onDragEnd"
			@change="onChange"
		>
			<template #item="{ element: server }">
				<Server :server="server" />
			</template>
		</draggable>
		<ServerAdd />
	</div>
</template>

<style scoped>
	.server-list {
		width: 100%;
		padding-inline: 10px;
		display: flex;
		flex-direction: column;
		justify-content: flex-start;
		align-items: center;
	}
	.separator {
		width: 100%;
		height: 1px;
		background-color: var(--border);
		margin: 7px 0px;
	}
	.draggable-zone {
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	.ghost-server {
		opacity: 0.3;
		border-radius: 16px;
	}
	.drag-server {
		opacity: 0.9 !important;
		border-radius: 16px;
		box-shadow: 0 8px 15px rgba(0, 0, 0, 0.4) !important;
	}
	.drag-server :deep(.server-image),
	.ghost-server :deep(.server-image) {
		border-radius: 16px;
	}
</style>
