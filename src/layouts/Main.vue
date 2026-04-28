<script setup lang="ts">
	import ServerList from '@/components/Server/ServerList.vue';
	import UserCard from '@/components/UserCard.vue';
	import { useAppStore } from '@/stores/app';

	const appStore = useAppStore();
</script>

<template>
	<Transition name="fade" mode="out-in">
		<div v-if="appStore.loading" class="splash-screen">
			<img src="/default-server-icon.png" alt="" />
		</div>
		<div v-else class="main-layout">
			<aside class="server-sidebar">
				<ServerList />
			</aside>
			<section class="content-view">
				<router-view />
			</section>
			<UserCard />
		</div>
	</Transition>
</template>

<style scoped>
	.main-layout {
		display: grid;
		grid-template-columns: 70px 1fr;
		height: calc(100% - 30px);
		width: 100%;
		position: absolute;
		top: 30px;
		left: 0;
		overflow: auto;
	}

	.server-sidebar {
		height: 100%;
		padding-top: 5px;
		overflow-y: auto;
		scrollbar-width: none;
	}

	.content-view {
		height: 100%;
		min-width: 800px;
		overflow: hidden;
		border-left: 1px solid var(--border);
		border-top: 1px solid var(--border);
		border-top-left-radius: 20px;
		position: relative;
	}

	.fade-enter-active,
	.fade-leave-active {
		transition: opacity 0.3s ease-out;
	}
	.fade-enter-from,
	.fade-leave-to {
		opacity: 0;
	}

	.splash-screen {
		position: absolute;
		top: 30px;
		left: 0;
		width: 100%;
		height: 100%;
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.splash-screen img {
		width: 200px;
		object-fit: contain;
	}
</style>
