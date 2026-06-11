<script setup lang="ts">
	import { ref, computed, watchEffect } from 'vue';
	import { useModalStore } from '@/stores/modal';
	import { useServerStore } from '@/stores/server';
	import { Icon } from '@iconify/vue';
	import { can } from '@/utils/perms';

	import GeneralTab from './ServerSettings/GeneralTab.vue';
	import RolesTab from './ServerSettings/RolesTab.vue';
	import InvitesTab from './ServerSettings/InvitesTab.vue';
	import BansTab from './ServerSettings/BansTab.vue';

	const modalStore = useModalStore();
	const serverStore = useServerStore();

	const activeTab = ref('general');
	const server_id = modalStore.data?.server_id;
	const server = computed(() => serverStore.getServerById(server_id));
	const p = can(server);

	const tabs = computed(() => [
		{ id: 'general', label: 'General', icon: 'mdi:cog', show: true },
		{ id: 'roles', label: 'Roles', icon: 'mdi:shield-account', show: p.manageRoles },
		{ id: 'invites', label: 'Invites', icon: 'mdi:link-variant', show: p.createInvite || p.deleteInvite },
		{ id: 'bans', label: 'Bans', icon: 'mdi:account-cancel', show: p.banMembers },
	]);

	watchEffect(() => {
		const current = tabs.value.find((t) => t.id === activeTab.value);
		if (!current || !current.show) activeTab.value = 'general';
	});

	function close() {
		modalStore.closeModal();
	}
</script>

<template>
	<div class="modal-backdrop" @click="close">
		<div class="settings-root" @click.stop>
			<!-- Sidebar -->
			<aside class="settings-sidebar">
				<div class="sidebar-label">{{ server?.name }}</div>
				<nav class="sidebar-nav">
					<template v-for="t in tabs" :key="t.id">
						<button v-if="t.show" :class="{ active: activeTab === t.id }" @click="activeTab = t.id">
							<Icon :icon="t.icon" class="nav-icon" /> {{ t.label }}
						</button>
					</template>
				</nav>
			</aside>

			<!-- Content panel -->
			<main class="settings-main">
				<button class="close-btn" @click="close">
					<Icon icon="mdi:close" />
				</button>

				<GeneralTab v-if="activeTab === 'general'" :server-id="server_id" />
				<RolesTab v-else-if="activeTab === 'roles'" :server-id="server_id" />
				<InvitesTab v-else-if="activeTab === 'invites'" :server-id="server_id" />
				<BansTab v-else-if="activeTab === 'bans'" :server-id="server_id" />
			</main>
		</div>
	</div>
</template>

<style scoped>
	.settings-root {
		display: flex;
		width: 1060px;
		max-width: 95vw;
		height: 720px;
		max-height: 90vh;
		border-radius: 12px;
		overflow: hidden;
		background-color: var(--bg);
		border: 1px solid var(--border);
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55);
	}

	.settings-sidebar {
		width: 220px;
		flex-shrink: 0;
		background-color: var(--bg-dark);
		border-right: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		padding: 24px 12px;
	}

	.sidebar-label {
		font-size: 0.7rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.6px;
		color: var(--text-muted);
		padding: 0 10px 20px;
		border-bottom: 1px solid var(--border);
		margin-bottom: 12px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.sidebar-nav {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.sidebar-nav button {
		display: flex;
		align-items: center;
		gap: 10px;
		background: transparent;
		border: none;
		color: var(--text-muted);
		text-align: left;
		padding: 9px 12px;
		border-radius: 6px;
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s;
	}

	.sidebar-nav button:hover {
		background-color: var(--bg-light);
		color: var(--text);
	}

	.sidebar-nav button.active {
		background-color: rgba(114, 137, 218, 0.15);
		color: var(--color-lighter);
	}

	.nav-icon {
		font-size: 1.1rem;
		flex-shrink: 0;
	}

	.settings-main {
		flex: 1;
		display: flex;
		flex-direction: column;
		position: relative;
		overflow: hidden;
	}

	.close-btn {
		position: absolute;
		top: 20px;
		right: 20px;
		z-index: 2;
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		font-size: 1.5rem;
		transition: color 0.2s;
		padding: 0;
		display: flex;
		align-items: center;
	}

	.close-btn:hover {
		color: var(--text);
	}
</style>
