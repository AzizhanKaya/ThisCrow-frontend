<script setup lang="ts">
	import { useModalStore } from '@/stores/modal';
	import { Icon } from '@iconify/vue';
	import { ref } from 'vue';

	const modalStore = useModalStore();
	const isExecuting = ref(false);

	const { icon, title, text, command } = modalStore.data || {};

	function close() {
		modalStore.closeModal();
	}

	async function confirm() {
		if (command && typeof command === 'function') {
			isExecuting.value = true;
			try {
				await command();
			} catch (e) {
				console.error('Command failed:', e);
			} finally {
				isExecuting.value = false;
				close();
			}
		} else {
			close();
		}
	}
</script>

<template>
	<div class="modal-backdrop" @click="close">
		<div class="modal-card" @click.stop>
			<button class="close-btn" @click="close">
				<Icon icon="mdi:close" />
			</button>
			<div class="modal-content">
				<div v-if="icon" class="icon-wrapper">
					<Icon :icon="icon" class="confirm-icon" />
				</div>
				<h2 class="title">{{ title || 'Are you sure?' }}</h2>
				<p class="text">{{ text || 'This action cannot be undone.' }}</p>
			</div>
			<div class="modal-footer">
				<button class="btn-secondary" @click="close">Cancel</button>
				<button class="btn-confirm" :disabled="isExecuting" @click="confirm">
					<Icon v-if="isExecuting" icon="mdi:loading" class="spin" />
					<span v-else>Confirm</span>
				</button>
			</div>
		</div>
	</div>
</template>

<style scoped>
	.modal-card {
		width: 400px;
		background-color: var(--bg-dark);
		border-radius: 12px;
		box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
		border: 1px solid var(--border);
		overflow: hidden;
		display: flex;
		flex-direction: column;
		position: relative;
	}

	.close-btn {
		position: absolute;
		top: 12px;
		right: 12px;
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		font-size: 1.25rem;
		transition: color 0.2s;
		padding: 4px;
		display: flex;
		align-items: center;
		z-index: 10;
	}

	.close-btn:hover {
		color: var(--text);
	}

	.modal-content {
		padding: 40px 24px 24px;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
	}

	.icon-wrapper {
		width: 64px;
		height: 64px;
		background-color: var(--bg);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 20px;
		border: 1px solid var(--border);
	}

	.confirm-icon {
		font-size: 32px;
		color: var(--error);
	}

	.title {
		margin: 0 0 12px;
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text);
	}

	.text {
		margin: 0;
		font-size: 0.95rem;
		color: var(--text-muted);
		line-height: 1.5;
	}

	.modal-footer {
		padding: 16px 24px 24px;
		background-color: var(--bg-darker);
		display: flex;
		gap: 12px;
	}

	.btn-secondary,
	.btn-confirm {
		flex: 1;
		padding: 10px;
		border-radius: 6px;
		font-weight: 600;
		font-size: 0.9rem;
		cursor: pointer;
		transition: all 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
	}

	.btn-secondary {
		background: transparent;
		border: 1px solid var(--border);
		color: var(--text);
	}

	.btn-secondary:hover {
		background-color: var(--bg);
	}

	.btn-confirm {
		background-color: var(--error);
		color: white;
		border: none;
	}

	.btn-confirm:hover:not(:disabled) {
		background-color: var(--error-hover);
	}

	.btn-confirm:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.spin {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
