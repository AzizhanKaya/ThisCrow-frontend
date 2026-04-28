<script setup lang="ts">
	import Server from '@/components/Server/ServerIcon.vue';
	import { useServerStore } from '@/stores/server';
	import CrowIcon from '@/components/CrowIcon.vue';
	import { computed } from 'vue';
	import ServerAdd from '@/components/Server/ServerAdd.vue';

	const serverStore = useServerStore();
	const servers = computed(() => Array.from(serverStore.servers).reverse());
</script>

<template>
	<div class="server-list">
		<CrowIcon />
		<div v-if="servers.length > 0" class="separator"></div>
		<Server v-for="[id, server] in servers" :key="id.toString()" :server="server" />
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
</style>
