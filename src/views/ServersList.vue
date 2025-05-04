<script setup lang="ts">
	import { ref } from 'vue';
	import { getServerList } from '@/api/state';
	import Server from '@/components/Server.vue';

	const { servers, error, isFetching } = getServerList();
</script>

<template>
	<div v-if="isFetching" class="loading-state">Yükleniyor...</div>
	<div v-else-if="error" class="error-state">Bir hata oluştu: {{ error }}</div>
	<div v-else-if="servers" class="server-list">
		<Server v-for="server in servers" :key="server.id" :server="server" />
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
