<script setup lang="ts">
	import { ref, onMounted } from 'vue';
	import { getBans, unbanUser, type BannedUser } from '@/api/ban';
	import { useErrorStore } from '@/stores/error';
	import { useUserStore } from '@/stores/user';
	import { getDefaultAvatar } from '@/utils/avatar';
	import { Icon } from '@iconify/vue';
	import type { id } from '@/types';

	const props = defineProps<{
		serverId: id;
	}>();

	const errorStore = useErrorStore();
	const userStore = useUserStore();

	const bans = ref<BannedUser[]>([]);
	const isLoadingBans = ref(false);

	onMounted(async () => {
		if (props.serverId) await loadBans();
	});

	async function loadBans() {
		if (!props.serverId) return;
		isLoadingBans.value = true;
		try {
			const data = await getBans(props.serverId);
			bans.value = data;

			const bannerIds = new Set<id>();
			for (const b of data) {
				if (b.banned_by) bannerIds.add(b.banned_by);
			}
			if (bannerIds.size > 0) {
				await userStore.getUsers(Array.from(bannerIds));
			}
		} catch (e) {
			console.error('Failed to fetch bans', e);
			errorStore.pushFrom(e, 'Failed to load bans.');
		} finally {
			isLoadingBans.value = false;
		}
	}

	async function unban(user_id: number) {
		if (!props.serverId) return;
		try {
			await unbanUser(props.serverId, user_id);
			bans.value = bans.value.filter((b) => b.id !== user_id);
		} catch (e) {
			console.error('Failed to unban user', e);
			errorStore.pushFrom(e, 'Failed to unban user.');
		}
	}

	function formatBanDate(iso: string) {
		const d = new Date(iso);
		return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
	}
</script>

<template>
	<div class="content-scroll">
		<h2 class="content-title">Banned Users</h2>

		<div v-if="isLoadingBans" class="empty-state">
			<Icon icon="mdi:loading" class="spin empty-icon" />
			<span>Loading…</span>
		</div>

		<div v-else-if="bans.length === 0" class="empty-state">
			<Icon icon="mdi:account-cancel-outline" class="empty-icon" />
			<span>No banned users</span>
		</div>

		<div v-else class="ban-list">
			<div v-for="b in bans" :key="b.id" class="ban-row">
				<img :src="b.avatar || getDefaultAvatar(b.username)" alt="avatar" class="ban-avatar" />
				<div class="ban-info">
					<div class="ban-names">
						<span class="ban-name">{{ b.name }}</span>
						<span class="ban-username">@{{ b.username }}</span>
					</div>
					<div class="ban-meta">
						<template v-if="b.banned_by">
							<span
								>Banned by {{ userStore.users.get(b.banned_by) ? '@' + userStore.users.get(b.banned_by)!.username : 'Unknown' }}</span
							>
							<span class="meta-divider">•</span>
						</template>
						<Icon icon="mdi:clock-outline" class="meta-icon" />
						<span>{{ formatBanDate(b.banned_at) }}</span>
					</div>
				</div>
				<button class="btn-secondary" @click="unban(b.id)"><Icon icon="mdi:account-check-outline" /> Unban</button>
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

	.ban-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.ban-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		background-color: var(--bg-dark);
		border: 1px solid var(--border);
		border-radius: 8px;
		transition: background 0.15s;
	}

	.ban-row:hover {
		background-color: var(--bg-light);
	}

	.ban-avatar {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		object-fit: cover;
		flex-shrink: 0;
		background-color: var(--bg);
	}

	.ban-info {
		display: flex;
		flex-direction: column;
		gap: 4px;
		flex: 1;
		min-width: 0;
	}

	.ban-names {
		display: flex;
		align-items: baseline;
		gap: 6px;
		min-width: 0;
	}

	.ban-name {
		font-weight: 600;
		color: var(--text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.ban-username {
		font-size: 0.8rem;
		color: var(--text-muted);
		white-space: nowrap;
	}

	.ban-meta {
		display: flex;
		font-size: 0.78rem;
		color: var(--text-muted);
	}

	.meta-icon {
		vertical-align: -2px;
		margin-right: 3px;
		font-size: 0.85rem;
	}

	.meta-divider {
		margin: 0 6px;
		opacity: 0.5;
	}

	.btn-secondary {
		background-color: transparent;
		color: var(--text);
		border: 1px solid var(--border);
		padding: 6px 14px;
		border-radius: 6px;
		font-weight: 500;
		font-size: 0.85rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 6px;
		transition: all 0.15s;
		flex-shrink: 0;
	}

	.btn-secondary:hover {
		background-color: var(--bg-light);
		border-color: var(--text-muted);
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
