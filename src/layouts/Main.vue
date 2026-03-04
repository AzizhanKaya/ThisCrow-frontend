<script setup lang="ts">
	import ServerList from '@/components/Group/ServerList.vue';
	import UserCard from '@/components/UserCard.vue';
</script>

<template>
	<div class="main-layout">
		<aside class="server-sidebar">
			<ServerList />
		</aside>
		<section class="content-view">
			<router-view />
		</section>
		<UserCard />
	</div>
</template>

<style scoped>
	.main-layout {
		display: grid;
		grid-template-columns: 70px 1fr;
		overflow: hidden;
		height: calc(100% - 30px);
	}

	.server-sidebar {
		padding-top: 5px;
	}

	.content-view {
		border-top-left-radius: 15px;
		min-width: 500px;
		border-left: 1px solid var(--border);
		border-top: 1px solid var(--border);
		border-top-left-radius: 20px;
	}
</style>
