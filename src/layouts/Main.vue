<script setup lang="ts">
	import ServerList from '@/components/Server/ServerList.vue';
	import UserCard from '@/components/UserCard.vue';
	import Header from '@/components/Header.vue';
	import Modals from '@/components/Modals.vue';
	import GlobalVoiceOverlay from '@/components/Voice/GlobalVoiceOverlay.vue';
	import ErrorToasts from '@/components/ErrorToasts.vue';
	import ContextMenu from '@/components/ContextMenu.vue';
	import ProfileCard from '@/components/ProfileCard.vue';
	import WatchPartyCard from '@/components/WatchPartyCard.vue';
	import { useAppStore } from '@/stores/app';
	import { useContextMenuStore } from '@/stores/contextMenu';

	const appStore = useAppStore();
	const contextMenuStore = useContextMenuStore();
</script>

<template>
	<div class="layout-root">
		<Header v-if="appStore.isTauri" />
		<Transition name="fade" mode="out-in">
			<div v-if="appStore.loading" class="splash-screen">
				<img src="/crow.png" alt="" />
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
		<Modals />
		<GlobalVoiceOverlay />
		<ErrorToasts />
		<ContextMenu
			:show="contextMenuStore.show"
			:x="contextMenuStore.x"
			:y="contextMenuStore.y"
			:target="contextMenuStore.target"
			:options="contextMenuStore.options"
			:submenu-direction="contextMenuStore.submenuDirection"
			:min-width="contextMenuStore.minWidth"
			:z-index="contextMenuStore.zIndex"
			@select="(action, option) => contextMenuStore.onSelect?.(action, option)"
			@close="contextMenuStore.close()"
		/>
		<ProfileCard />
		<WatchPartyCard />
	</div>
</template>

<style scoped>
	.layout-root {
		position: absolute;
		inset: 0;
	}

	.main-layout {
		display: grid;
		grid-template-columns: 70px 1fr;
		height: 100%;
		width: 100%;
		position: absolute;
		top: 0;
		left: 0;
		overflow: auto;
	}

	html.tauri .main-layout {
		top: 30px;
		height: calc(100% - 30px);
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
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		display: flex;
		justify-content: center;
		align-items: center;
	}

	html.tauri .splash-screen {
		top: 30px;
	}

	.splash-screen img {
		width: 200px;
		object-fit: contain;
	}
</style>
