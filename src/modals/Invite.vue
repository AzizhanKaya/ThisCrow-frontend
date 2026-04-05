<script setup lang="ts">
	import { ref } from 'vue';
	import { Icon } from '@iconify/vue';
	import { useModalStore } from '@/stores/modal';
	import { createInvitation } from '@/api/invite';
	import type { Invitation } from '@/api/invite';
	import type { id } from '@/types';

	const modalStore = useModalStore();

	const server_id = ref<id>(modalStore.data?.server_id ?? 0);
	const serverName = ref<string>(modalStore.data?.server_name ?? 'Server');
	const inviteLink = ref('');
	const copied = ref(false);
	const loading = ref(false);
	const error = ref('');
	const maxUses = ref(0);

	const expireOptions = [
		{ label: '30 Minutes', value: 30 * 60 * 1000 },
		{ label: '1 Hour', value: 60 * 60 * 1000 },
		{ label: '6 Hours', value: 6 * 60 * 60 * 1000 },
		{ label: '12 Hours', value: 12 * 60 * 60 * 1000 },
		{ label: '1 Day', value: 24 * 60 * 60 * 1000 },
		{ label: '7 Days', value: 7 * 24 * 60 * 60 * 1000 },
		{ label: '30 Days', value: 30 * 24 * 60 * 60 * 1000 },
		{ label: 'Never', value: 0 },
	];

	const selectedExpire = ref(expireOptions[4].value);

	const selectedExpireLabel = () => {
		return expireOptions.find((o) => o.value === selectedExpire.value)?.label ?? '';
	};

	const generateInvite = async () => {
		loading.value = true;
		error.value = '';
		try {
			const expiresAt =
				selectedExpire.value === 0
					? new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString()
					: new Date(Date.now() + selectedExpire.value).toISOString();

			const invitation = await createInvitation(server_id.value, expiresAt, maxUses.value > 0 ? maxUses.value : undefined);
			inviteLink.value = `${window.location.origin}/invite/${invitation.code}`;
		} catch (e: any) {
			error.value = e?.message ?? 'Failed to create invitation';
		} finally {
			loading.value = false;
		}
	};

	const copyLink = async () => {
		if (!inviteLink.value) return;
		try {
			await navigator.clipboard.writeText(inviteLink.value);
			copied.value = true;
			setTimeout(() => {
				copied.value = false;
			}, 2000);
		} catch {
			const input = document.createElement('input');
			input.value = inviteLink.value;
			document.body.appendChild(input);
			input.select();
			document.execCommand('copy');
			document.body.removeChild(input);
			copied.value = true;
			setTimeout(() => {
				copied.value = false;
			}, 2000);
		}
	};
</script>

<template>
	<div class="modal-backdrop" @click="modalStore.closeModal">
		<div class="modal-container" @click.stop>
			<header class="modal-header">
				<div class="title-group">
					<h2>Invite Others</h2>
					<span class="subtitle"
						>Share this link to invite others to <strong>{{ serverName }}</strong></span
					>
				</div>
				<button class="close-btn" @click="modalStore.closeModal">
					<Icon icon="mdi:close" />
				</button>
			</header>

			<div class="form-section">
				<div class="input-group">
					<label>EXPIRE AFTER</label>
					<div class="expire-row">
						<select v-model="selectedExpire" class="expire-select">
							<option v-for="opt in expireOptions" :key="opt.value" :value="opt.value">
								{{ opt.label }}
							</option>
						</select>
					</div>
				</div>

				<div class="input-group">
					<label>MAX NUMBER OF USES</label>
					<div class="slider-row">
						<input type="range" class="slider" v-model.number="maxUses" :min="0" :max="100" :step="1" />
						<span class="slider-value">{{ maxUses === 0 ? 'No Limit' : maxUses }}</span>
					</div>
				</div>

				<button class="generate-btn" :disabled="loading" @click="generateInvite">
					<Icon v-if="loading" icon="mdi:loading" class="spin" />
					<Icon v-else icon="mdi:link-plus" />
					<span>{{ loading ? 'Generating...' : 'Generate Invite Link' }}</span>
				</button>

				<div v-if="inviteLink || error" class="input-group">
					<label>INVITE LINK</label>
					<div class="input-wrapper" :class="{ 'is-loading': loading }">
						<input
							type="text"
							:value="loading ? 'Generating...' : inviteLink"
							readonly
							@click="($event.target as HTMLInputElement).select()"
						/>
						<button class="copy-btn" :class="{ copied }" :disabled="loading || !inviteLink" @click="copyLink">
							<Icon v-if="copied" icon="mdi:check" />
							<Icon v-else icon="mdi:content-copy" />
							<span>{{ copied ? 'Copied' : 'Copy' }}</span>
						</button>
					</div>
					<span v-if="error" class="error-text">{{ error }}</span>
				</div>
			</div>

			<footer class="modal-footer">
				<span class="footer-hint">
					<Icon icon="mdi:clock-outline" class="footer-icon" />
					{{
						selectedExpire === 0 ? 'This invite link will never expire.' : `Your invite link will expire in ${selectedExpireLabel()}.`
					}}
				</span>
			</footer>
		</div>
	</div>
</template>

<style scoped>
	.modal-container {
		background-color: var(--bg);
		width: 440px;
		max-width: 90%;
		border-radius: 12px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
		overflow: hidden;
		border: 1px solid var(--border);
		display: flex;
		flex-direction: column;
	}

	.modal-header {
		padding: 24px 24px 10px;
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
	}

	.modal-header h2 {
		margin: 0 0 6px;
		font-size: 1.3rem;
		color: var(--text);
		font-weight: 700;
		letter-spacing: 0.5px;
	}

	.subtitle {
		color: var(--text-muted);
		font-size: 0.9rem;
		line-height: 1.4;
		display: block;
	}

	.subtitle strong {
		color: var(--text);
	}

	.close-btn {
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

	.form-section {
		padding: 16px 24px 4px;
	}

	.input-group {
		display: flex;
		flex-direction: column;
		margin-bottom: 20px;
	}

	.input-group label {
		display: block;
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--text-muted);
		margin-bottom: 8px;
	}

	.expire-row {
		display: flex;
		gap: 8px;
	}

	.expire-select {
		flex: 1;
		padding: 10px 14px;
		background-color: var(--bg-dark);
		border: 1px solid var(--border-muted);
		border-radius: 8px;
		color: var(--text);
		font-size: 14px;
		outline: none;
		cursor: pointer;
		appearance: none;
		-webkit-appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'%3E%3Cpath fill='%23999' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 12px center;
		background-size: 16px;
		transition: all 0.2s;
	}

	.expire-select:focus {
		border-color: var(--color);
		box-shadow: 0 0 0 2px rgba(114, 137, 218, 0.1);
	}

	.expire-select option {
		background-color: var(--bg-dark);
		color: var(--text);
	}

	.input-wrapper {
		position: relative;
		background-color: var(--bg-dark);
		border: 1px solid var(--border-muted);
		border-radius: 8px;
		padding: 0 4px 0 14px;
		display: flex;
		align-items: center;
		transition: all 0.2s;
	}

	.input-wrapper.is-loading {
		opacity: 0.6;
	}

	.input-wrapper:focus-within {
		border-color: var(--color);
		box-shadow: 0 0 0 2px rgba(114, 137, 218, 0.1);
	}

	.input-wrapper input {
		width: 100%;
		padding: 14px 0;
		background: transparent;
		border: none;
		color: var(--text);
		font-size: 14px;
		outline: none;
		cursor: text;
	}

	.copy-btn {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: 6px;
		background-color: var(--color);
		color: white;
		border: none;
		padding: 8px 14px;
		border-radius: 6px;
		font-weight: 600;
		font-size: 0.85rem;
		cursor: pointer;
		transition: all 0.2s;
		white-space: nowrap;
	}

	.copy-btn:hover:not(:disabled) {
		background-color: var(--color-light);
	}

	.copy-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.copy-btn.copied {
		background-color: var(--success, #3ba55c);
	}

	.error-text {
		color: var(--error, #ed4245);
		font-size: 0.8rem;
		margin-top: 6px;
	}

	.modal-footer {
		background-color: var(--bg-dark);
		padding: 16px 24px;
		display: flex;
		justify-content: center;
		align-items: center;
		border-top: 1px solid var(--border);
		margin-top: 10px;
	}

	.footer-hint {
		color: var(--text-muted);
		font-size: 0.8rem;
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.footer-icon {
		font-size: 1rem;
		opacity: 0.7;
	}

	.slider-row {
		display: flex;
		align-items: center;
		gap: 14px;
	}

	.slider {
		flex: 1;
		-webkit-appearance: none;
		appearance: none;
		height: 6px;
		border-radius: 3px;
		background: var(--border-muted);
		outline: none;
		transition: background 0.2s;
	}

	.slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--color);
		cursor: pointer;
		border: 2px solid var(--bg);
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
		transition:
			transform 0.15s,
			box-shadow 0.15s;
	}

	.slider::-webkit-slider-thumb:hover {
		transform: scale(1.15);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
	}

	.slider::-moz-range-thumb {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--color);
		cursor: pointer;
		border: 2px solid var(--bg);
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
	}

	.slider::-moz-range-track {
		height: 6px;
		border-radius: 3px;
		background: var(--border-muted);
	}

	.slider-value {
		min-width: 60px;
		text-align: center;
		color: var(--text);
		font-size: 0.85rem;
		font-weight: 600;
		background-color: var(--bg-dark);
		padding: 6px 10px;
		border-radius: 6px;
		border: 1px solid var(--border-muted);
	}

	.generate-btn {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 12px;
		margin-bottom: 20px;
		background-color: var(--color);
		color: white;
		border: none;
		border-radius: 8px;
		font-weight: 600;
		font-size: 0.9rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.generate-btn:hover:not(:disabled) {
		background-color: var(--color-light);
	}

	.generate-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
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
