<script setup lang="ts">
	import { ref, onMounted } from 'vue';
	import { useRouter } from 'vue-router';
	import { Icon } from '@iconify/vue';
	import { useModalStore } from '@/stores/modal';
	import { getInvitationInfo, joinInvitation } from '@/api/invite';
	import type { InvitationInfo } from '@/api/invite';

	const modalStore = useModalStore();
	const router = useRouter();

	const code = ref<string>(modalStore.data?.code ?? '');
	const info = ref<InvitationInfo | null>(null);
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
			status.value = 'ready';
		} catch (e: any) {
			status.value = 'error';
			errorMessage.value = e?.message ?? 'Invitation not found or expired.';
		}
	});

	const handleJoin = async () => {
		status.value = 'joining';
		try {
			await joinInvitation(code.value);
			modalStore.closeModal();
			router.push({ name: 'server', params: { serverId: info.value!.group_id } });
		} catch (e: any) {
			status.value = 'error';
			errorMessage.value = e?.message ?? 'Failed to join server.';
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
				<div class="server-banner">
					<div class="server-icon-wrapper">
						<div v-if="info.group_icon" class="server-icon">
							<img :src="info.group_icon" :alt="info.group_name" />
						</div>
						<div v-else class="server-icon placeholder-icon">
							{{ info.group_name.charAt(0).toUpperCase() }}
						</div>
					</div>
				</div>

				<div class="server-details">
					<h2 class="server-name">{{ info.group_name }}</h2>
					<p v-if="info.group_description" class="server-description">
						{{ info.group_description }}
					</p>

					<div class="server-meta">
						<span class="meta-item">
							<Icon icon="mdi:account-group" />
							{{ info.member_count }} {{ info.member_count === 1 ? 'Member' : 'Members' }}
						</span>
					</div>
				</div>

				<div class="actions">
					<button class="btn-secondary" @click="modalStore.closeModal">No Thanks</button>
					<button class="btn-join" :disabled="status === 'joining'" @click="handleJoin">
						<Icon v-if="status === 'joining'" icon="mdi:loading" class="spin" />
						<span>{{ status === 'joining' ? 'Joining...' : 'Accept Invite' }}</span>
					</button>
				</div>
			</template>
		</div>
	</div>
</template>

<style scoped>
	.modal-container {
		background-color: var(--bg-darker);
		width: 400px;
		max-width: 90%;
		border-radius: 12px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
		overflow: hidden;
		border: 1px solid var(--border);
		display: flex;
		flex-direction: column;
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

	.server-banner {
		background: linear-gradient(135deg, var(--color-dark) 0%, var(--color-light) 100%);
		padding: 32px 24px 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
	}

	.server-icon-wrapper {
		position: absolute;
		bottom: -30px;
	}

	.server-icon {
		width: 64px;
		height: 64px;
		border-radius: 50%;
		overflow: hidden;
		border: 4px solid var(--bg-darker);
		background-color: var(--bg-dark);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.server-icon img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.placeholder-icon {
		font-size: 1.6rem;
		font-weight: 700;
		color: var(--text);
	}

	.server-details {
		padding: 40px 24px 16px;
		text-align: center;
	}

	.server-name {
		margin: 0 0 6px;
		font-size: 1.3rem;
		font-weight: 700;
		color: var(--text);
	}

	.server-description {
		margin: 0 0 12px;
		color: var(--text-muted);
		font-size: 0.9rem;
		line-height: 1.4;
	}

	.server-meta {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 16px;
	}

	.meta-item {
		display: flex;
		align-items: center;
		gap: 5px;
		color: var(--text-muted);
		font-size: 0.85rem;
	}

	.actions {
		padding: 16px 24px 24px;
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
