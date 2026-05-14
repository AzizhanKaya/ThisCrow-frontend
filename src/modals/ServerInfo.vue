<script setup lang="ts">
	import { computed } from 'vue';
	import { Icon } from '@iconify/vue';
	import { useModalStore } from '@/stores/modal';
	import { useServerStore } from '@/stores/server';
	import { useUserStore } from '@/stores/user';
	import { ChannelType, type id } from '@/types';

	const modalStore = useModalStore();
	const serverStore = useServerStore();
	const userStore = useUserStore();

	const server_id = computed<id>(() => modalStore.data?.server_id ?? 0);
	const server = computed(() => serverStore.getServerById(server_id.value));

	const owner = computed(() => {
		if (!server.value?.owner || !server.value.members) return null;
		const member = server.value.members.get(server.value.owner);
		return member?.user ?? null;
	});

	const memberCount = computed(() => server.value?.members?.size ?? 0);

	const onlineCount = computed(() => {
		if (!server.value?.members) return 0;
		let count = 0;
		for (const [, member] of server.value.members) {
			if (member.user.status !== 'Offline') count++;
		}
		return count;
	});

	const textChannelCount = computed(() => {
		if (!server.value?.channels) return 0;
		let count = 0;
		for (const [, ch] of server.value.channels) {
			if (ch.type === ChannelType.Text) count++;
		}
		return count;
	});

	const voiceChannelCount = computed(() => {
		if (!server.value?.channels) return 0;
		let count = 0;
		for (const [, ch] of server.value.channels) {
			if (ch.type === ChannelType.Voice) count++;
		}
		return count;
	});

	const roles = computed(() => {
		if (!server.value?.roles) return [];
		return [...server.value.roles.values()].sort((a, b) => a.position - b.position);
	});
</script>

<template>
	<div class="modal-backdrop" @click="modalStore.closeModal">
		<div class="modal-container" @click.stop>
			<div class="server-body">
				<div class="server-header">
					<img v-if="server?.icon" :src="server.icon" alt="Server Icon" class="server-icon" />
					<div v-else class="server-icon placeholder-icon">
						<span>{{ server?.name?.charAt(0)?.toUpperCase() }}</span>
					</div>
					<button class="close-btn" @click="modalStore.closeModal">
						<Icon icon="mdi:close" />
					</button>
				</div>
				<h2 class="server-name">{{ server?.name }}</h2>
				<p v-if="server?.description" class="server-description">{{ server.description }}</p>
				<p v-else class="server-description muted">No description set.</p>

				<!-- Stats Grid -->
				<div class="stats-grid">
					<div class="stat-card">
						<Icon icon="mdi:account-group" class="stat-icon" />
						<div class="stat-data">
							<span class="stat-value">{{ memberCount }}</span>
							<span class="stat-label">Members</span>
						</div>
					</div>
					<div class="stat-card">
						<Icon icon="mdi:circle" class="stat-icon online" />
						<div class="stat-data">
							<span class="stat-value">{{ onlineCount }}</span>
							<span class="stat-label">Online</span>
						</div>
					</div>
					<div class="stat-card">
						<Icon icon="glyphs:hash-bold" class="stat-icon" />
						<div class="stat-data">
							<span class="stat-value">{{ textChannelCount }}</span>
							<span class="stat-label">Text</span>
						</div>
					</div>
					<div class="stat-card">
						<Icon icon="mdi:volume-high" class="stat-icon" />
						<div class="stat-data">
							<span class="stat-value">{{ voiceChannelCount }}</span>
							<span class="stat-label">Voice</span>
						</div>
					</div>
				</div>

				<!-- Owner -->
				<div class="info-section" v-if="owner">
					<h3 class="section-title">Owner</h3>
					<div class="owner-card">
						<img v-if="owner.avatar" :src="owner.avatar" alt="" class="owner-avatar" />
						<div v-else class="owner-avatar placeholder-avatar">
							<span>{{ owner.name?.charAt(0)?.toUpperCase() }}</span>
						</div>
						<div class="owner-info">
							<span class="owner-name">{{ owner.name }}</span>
							<span class="owner-username">@{{ owner.username }}</span>
						</div>
						<Icon icon="mdi:crown" class="crown-icon" />
					</div>
				</div>

				<!-- Roles -->
				<div class="info-section" v-if="roles.length > 0">
					<h3 class="section-title">Roles — {{ roles.length }}</h3>
					<div class="roles-list">
						<div v-for="role in roles" :key="role.id" class="role-chip">
							<span class="role-dot" :style="{ backgroundColor: role.color }"></span>
							<span class="role-name">{{ role.name }}</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<style scoped>
	.modal-container {
		background-color: var(--bg);
		width: 480px;
		max-width: 90vw;
		max-height: 80vh;
		border-radius: 12px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
		overflow: hidden;
		border: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		position: relative;
	}

	.server-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 16px;
	}

	.close-btn {
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		font-size: 1.3rem;
		padding: 6px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s;
	}

	.close-btn:hover {
		color: var(--text);
		background-color: var(--bg-dark);
	}

	.server-icon {
		width: 64px;
		height: 64px;
		border-radius: 16px;
		object-fit: cover;
		border: 2px solid var(--border-muted);
	}

	.placeholder-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: var(--bg-dark);
		font-size: 1.6rem;
		font-weight: 700;
		color: var(--text);
	}

	/* Body */
	.server-body {
		padding: 24px;
		overflow-y: auto;
	}

	.server-name {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 800;
		color: var(--text);
		letter-spacing: -0.3px;
	}

	.server-description {
		margin: 8px 0 0;
		font-size: 0.9rem;
		color: var(--text-muted);
		line-height: 1.5;
	}

	.server-description.muted {
		font-style: italic;
		opacity: 0.6;
	}

	/* Stats */
	.stats-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 10px;
		margin-top: 20px;
	}

	.stat-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 14px 8px;
		background-color: var(--bg-dark);
		border-radius: 10px;
		border: 1px solid var(--border-muted);
		transition: all 0.2s;
	}

	.stat-card:hover {
		border-color: var(--border);
		transform: translateY(-1px);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
	}

	.stat-icon {
		font-size: 1.2rem;
		color: var(--text-muted);
	}

	.stat-icon.online {
		color: var(--success, #3ba55c);
		font-size: 0.9rem;
	}

	.stat-data {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.stat-value {
		font-size: 1.15rem;
		font-weight: 700;
		color: var(--text);
	}

	.stat-label {
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	/* Sections */
	.info-section {
		margin-top: 20px;
	}

	.section-title {
		margin: 0 0 10px;
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	/* Owner */
	.owner-card {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 14px;
		background-color: var(--bg-dark);
		border-radius: 10px;
		border: 1px solid var(--border-muted);
		transition: all 0.2s;
	}

	.owner-card:hover {
		border-color: var(--border);
	}

	.owner-avatar {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		object-fit: cover;
		flex-shrink: 0;
	}

	.placeholder-avatar {
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: var(--color);
		color: white;
		font-size: 0.9rem;
		font-weight: 700;
	}

	.owner-info {
		display: flex;
		flex-direction: column;
		min-width: 0;
		flex: 1;
	}

	.owner-name {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.owner-username {
		font-size: 0.78rem;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.crown-icon {
		color: #f0b232;
		font-size: 1.2rem;
		flex-shrink: 0;
	}

	/* Roles */
	.roles-list {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.role-chip {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px;
		background-color: var(--bg-dark);
		border-radius: 14px;
		border: 1px solid var(--border-muted);
		font-size: 0.8rem;
		color: var(--text);
		transition: all 0.15s;
	}

	.role-chip:hover {
		border-color: var(--border);
	}

	.role-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.role-name {
		white-space: nowrap;
		font-weight: 500;
	}
</style>
