<script setup lang="ts">
	import { ref, computed } from 'vue';
	import { useModalStore } from '@/stores/modal';
	import { useServerStore } from '@/stores/server';
	import { useMeStore } from '@/stores/me';
	import { Icon } from '@iconify/vue';
	import { computeGroupPermissions } from '@/utils/permissions';
	import { Permissions } from '@/types';

	import GeneralTab from './ServerSettings/GeneralTab.vue';
	import RolesTab from './ServerSettings/RolesTab.vue';
	import InvitesTab from './ServerSettings/InvitesTab.vue';
	import BansTab from './ServerSettings/BansTab.vue';

	const modalStore = useModalStore();
	const serverStore = useServerStore();
	const meStore = useMeStore();

	const activeTab = ref('general');
	const server_id = modalStore.data?.server_id;
	const server = computed(() => serverStore.getServerById(server_id));

	const canManageBans = computed(() => {
		if (!server.value || !meStore.me) return false;
		const perms = computeGroupPermissions(server.value, meStore.me.id);
		return (perms & (Permissions.BAN_MEMBERS | Permissions.ADMINISTRATOR)) !== 0;
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
					<button :class="{ active: activeTab === 'general' }" @click="activeTab = 'general'">
						<Icon icon="mdi:cog" class="nav-icon" /> General
					</button>
					<button :class="{ active: activeTab === 'roles' }" @click="activeTab = 'roles'">
						<Icon icon="mdi:shield-account" class="nav-icon" /> Roles
					</button>
					<button :class="{ active: activeTab === 'invites' }" @click="activeTab = 'invites'">
						<Icon icon="mdi:link-variant" class="nav-icon" /> Invites
					</button>
					<button v-if="canManageBans" :class="{ active: activeTab === 'bans' }" @click="activeTab = 'bans'">
						<Icon icon="mdi:account-cancel" class="nav-icon" /> Bans
					</button>
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
