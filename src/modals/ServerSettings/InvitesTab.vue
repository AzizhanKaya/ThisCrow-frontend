<script setup lang="ts">
	import { ref, onMounted } from 'vue';
	import { getGroupInvitations, deleteInvitation, type Invitation } from '@/api/invite';
	import { useErrorStore } from '@/stores/error';
	import { Icon } from '@iconify/vue';
	import type { id } from '@/types';

	const props = defineProps<{
		serverId: id;
	}>();

	const errorStore = useErrorStore();

	const invites = ref<Invitation[]>([]);
	const isLoadingInvites = ref(false);

	onMounted(async () => {
		if (props.serverId) await loadInvites();
	});

	async function loadInvites() {
		if (!props.serverId) return;
		isLoadingInvites.value = true;
		try {
			invites.value = await getGroupInvitations(props.serverId);
		} catch (e) {
			console.error('Failed to fetch invites', e);
		} finally {
			isLoadingInvites.value = false;
		}
	}

	async function removeInvite(id: number) {
		try {
			await deleteInvitation(id);
			await loadInvites();
		} catch (e) {
			console.error('Failed to delete invite', e);
			errorStore.pushFrom(e, 'Failed to delete invite.');
		}
	}

	function timeRemaining(expires_at: string) {
		const diff = new Date(expires_at).getTime() - Date.now();
		if (diff <= 0) return 'Expired';
		const d = Math.floor(diff / 86400000);
		if (d > 0) return `${d}d left`;
		const h = Math.floor(diff / 3600000);
		if (h > 0) return `${h}h left`;
		return `${Math.floor(diff / 60000)}m left`;
	}
</script>

<template>
	<div class="content-scroll">
		<h2 class="content-title">Invites</h2>

		<div v-if="isLoadingInvites" class="empty-state">
			<Icon icon="mdi:loading" class="spin empty-icon" />
			<span>Loading…</span>
		</div>

		<div v-else-if="invites.length === 0" class="empty-state">
			<Icon icon="mdi:link-off" class="empty-icon" />
			<span>No active invites</span>
		</div>

		<div v-else class="invite-list">
			<div v-for="inv in invites" :key="inv.id" class="invite-row">
				<div class="invite-info">
					<span class="invite-code">{{ inv.code }}</span>
					<div class="invite-meta">
						<span><Icon icon="mdi:account-group" class="meta-icon" />{{ inv.uses }} / {{ inv.max_uses || '∞' }}</span>
						<span><Icon icon="mdi:clock-outline" class="meta-icon" />{{ timeRemaining(inv.expires_at) }}</span>
					</div>
				</div>
				<button class="icon-btn danger" @click="removeInvite(inv.id)" title="Revoke">
					<Icon icon="mdi:close-circle-outline" />
				</button>
			</div>
		</div>
	</div>
</template>

<style scoped>
	.content-scroll {
		flex: 1;
		overflow-y: auto;
		padding: 32px 40px 40px;
		position: relative;
		height: 100%;
	}

	.content-title {
		font-size: 1.3rem;
		font-weight: 700;
		color: var(--text);
		margin: 0 0 24px;
	}

	.invite-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.invite-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 16px;
		background-color: var(--bg-dark);
		border: 1px solid var(--border);
		border-radius: 8px;
		transition: background 0.15s;
	}

	.invite-row:hover {
		background-color: var(--bg-light);
	}

	.invite-info {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.invite-code {
		font-family: monospace;
		font-weight: 700;
		font-size: 1rem;
		color: var(--text);
		letter-spacing: 0.5px;
	}

	.invite-meta {
		display: flex;
		gap: 16px;
		font-size: 0.78rem;
		color: var(--text-muted);
	}

	.meta-icon {
		vertical-align: -2px;
		margin-right: 3px;
		font-size: 0.85rem;
	}

	.icon-btn {
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		font-size: 1rem;
		width: 26px;
		height: 26px;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s;
		flex-shrink: 0;
		opacity: 0;
	}

	.invite-row:hover .icon-btn {
		opacity: 1;
	}

	.icon-btn.danger:hover {
		color: var(--danger, #f23f42);
		background-color: rgba(242, 63, 66, 0.1);
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 40px 20px;
		color: var(--text-muted);
		text-align: center;
		gap: 8px;
	}

	.empty-icon {
		font-size: 2.5rem;
		opacity: 0.4;
	}

	.spin {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		100% {
			transform: rotate(360deg);
		}
	}
</style>
