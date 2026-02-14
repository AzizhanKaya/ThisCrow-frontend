<script setup lang="ts">
	import Server from '@/components/ServerIcon.vue';
	import { useServerStore } from '@/stores/server';
	import CrowIcon from '@/components/CrowIcon.vue';

	const serverStore = useServerStore();
	const servers = serverStore.servers;
</script>

<template>
	<div class="server-list">
		<CrowIcon />
		<Server v-for="[id, server] in servers" :key="id.toString()" :server="server" />
	</div>
</template>

<style scoped>
	.server-list {
		width: 70%;
		margin-inline: auto;
		display: flex;
		flex-direction: column;
		gap: 15px;
		justify-content: flex-start;
	}
</style>
