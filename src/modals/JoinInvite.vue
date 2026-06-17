<script setup lang="ts">
	import { ref, onMounted } from 'vue';
	import { useRouter } from 'vue-router';
	import { Icon } from '@iconify/vue';
	import { useModalStore } from '@/stores/modal';
	import { getInvitationInfo, joinInvitation } from '@/api/invite';
	import { useServerStore } from '@/stores/server';
	import { useUserStore } from '@/stores/user';
	import type { InvitationInfo } from '@/api/invite';
	import type { User } from '@/types';
	import { useErrorStore } from '@/stores/error';

	const modalStore = useModalStore();
	const serverStore = useServerStore();
	const userStore = useUserStore();
	const errorStore = useErrorStore();
	const router = useRouter();

	const code = ref<string>(modalStore.data?.code ?? '');
	const info = ref<InvitationInfo | null>(null);
	const owner = ref<User | null>(null);
	const status = ref<'loading' | 'ready' | 'joining' | 'error'>('loading');
	const errorMessage = ref('');

	onMounted(async () => {
		if (!code.value) {
			status.value = 'error';
			errorMessage.value = 'Invalid invite link.';
			return;
		}

		try {
			info.value = await getInvitationInfo(code.value);
			if (info.value.owner) {
				owner.value = await userStore.getUser(info.value.owner);
			}
			status.value = 'ready';
		} catch (e: any) {
			status.value = 'error';
			errorMessage.value = e?.message ?? 'Invitation not found or expired.';
		}
	});

	const handleJoin = async () => {
		status.value = 'joining';
		const invitation = info.value!;
		try {
			await joinInvitation(code.value);
			const maxPosition = [...serverStore.servers.values()].reduce((max, s) => (s.position > max ? s.position : max), 0);
			serverStore.servers.set(invitation.group_id, {
				id: invitation.group_id,
				name: invitation.group_name,
				icon: invitation.group_icon,
				position: maxPosition + 1,
			});
			router.push({ name: 'server', params: { serverId: invitation.group_id.toString() } });
			modalStore.closeModal();
		} catch (e: any) {
			status.value = 'error';
			errorMessage.value = e?.message ?? 'Failed to join server.';
			errorStore.pushFrom(e, 'Failed to join server.');
		}
	};
</script>

<template>
	<div class="modal-backdrop" @click="modalStore.closeModal">
		<div class="modal-container" @click.stop>
			<!-- Loading -->
			<div v-if="status === 'loading'" class="state-container">
				<Icon icon="mdi:loading" class="spin icon-xl" />
				<p class="state-text">Loading invite...</p>
			</div>

			<!-- Error -->
			<div v-else-if="status === 'error'" class="state-container">
				<Icon icon="mdi:alert-circle" class="icon-xl error-icon" />
				<h3>Couldn't Accept Invite</h3>
				<p class="state-text">{{ errorMessage }}</p>
				<button class="btn-secondary" @click="modalStore.closeModal">Close</button>
			</div>

			<!-- Ready / Joining -->
			<template v-else-if="info">
				<div class="server-body">
					<div class="server-header">
						<img v-if="info.group_icon" :src="info.group_icon" alt="Server Icon" class="server-icon" />
						<div v-else class="server-icon placeholder-icon">
							<span>{{ info.group_name.charAt(0).toUpperCase() }}</span>
						</div>
						<button class="close-btn" @click="modalStore.closeModal">
							<Icon icon="mdi:close" />
						</button>
					</div>
					<h2 class="server-name">{{ info.group_name }}</h2>
					<p v-if="info.group_description" class="server-description">{{ info.group_description }}</p>
					<p v-else class="server-description muted">No description set.</p>

					<!-- Stats Grid -->
					<div class="stats-grid">
						<div class="stat-card">
							<Icon icon="mdi:account-group" class="stat-icon" />
							<div class="stat-data">
								<span class="stat-value">{{ info.member_count }}</span>
								<span class="stat-label">Members</span>
							</div>
						</div>
						<div class="stat-card">
							<Icon icon="mdi:circle" class="stat-icon online" />
							<div class="stat-data">
								<span class="stat-value">{{ info.online_count }}</span>
								<span class="stat-label">Online</span>
							</div>
						</div>
						<div class="stat-card">
							<Icon icon="glyphs:hash-bold" class="stat-icon" />
							<div class="stat-data">
								<span class="stat-value">{{ info.text_channel_count }}</span>
								<span class="stat-label">Text</span>
							</div>
						</div>
						<div class="stat-card">
							<Icon icon="mdi:volume-high" class="stat-icon" />
							<div class="stat-data">
								<span class="stat-value">{{ info.voice_channel_count }}</span>
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

					<!-- Actions -->
					<div class="actions">
						<button class="btn-secondary" @click="modalStore.closeModal">No Thanks</button>
						<button class="btn-join" :disabled="status === 'joining'" @click="handleJoin">
							<Icon v-if="status === 'joining'" icon="mdi:loading" class="spin" />
							<span>{{ status === 'joining' ? 'Joining...' : 'Accept Invite' }}</span>
						</button>
					</div>
				</div>
			</template>
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

	.state-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 48px 32px;
		text-align: center;
	}

	.state-container h3 {
		margin: 0;
		color: var(--text);
		font-size: 1.2rem;
		font-weight: 700;
	}

	.state-text {
		margin: 0;
		color: var(--text-muted);
		font-size: 0.9rem;
	}

	.icon-xl {
		font-size: 2.5rem;
		color: var(--color);
	}

	.error-icon {
		color: var(--error);
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
		background-color: var(--bg-darker);
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

	/* Actions */
	.actions {
		margin-top: 24px;
		display: flex;
		flex-direction: row;
		gap: 10px;
	}

	.btn-join {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 12px;
		background-color: var(--color);
		color: white;
		border: none;
		border-radius: 8px;
		font-weight: 600;
		font-size: 0.95rem;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.btn-join:hover:not(:disabled) {
		background-color: var(--color-light);
	}

	.btn-join:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-secondary {
		flex: 1;
		padding: 12px;
		background-color: var(--bg-dark);
		border: 1px solid var(--border-muted);
		border-radius: 8px;
		color: var(--text-muted);
		font-weight: 600;
		font-size: 0.9rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-secondary:hover {
		background-color: var(--bg-light);
		color: var(--text);
	}

	.spin {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
</style>
