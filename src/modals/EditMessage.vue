<script setup lang="ts">
	import { ref, onMounted } from 'vue';
	import { useModalStore } from '@/stores/modal';
	import { useKeyStore } from '@/stores/key';
	import { overwriteMessage } from '@/api/message';
	import { generate_nonce, encrypt_message } from '../../pkg/wasm_lib';
	import type { Message } from '@/types';
	import { Icon } from '@iconify/vue';
	import { useErrorStore } from '@/stores/error';
	import { encode } from '@/utils/msgpack';

	const modalStore = useModalStore();
	const keyStore = useKeyStore();
	const errorStore = useErrorStore();

	const message = modalStore.data.message as Message;
	const group_id = modalStore.data.group_id as number | undefined;
	const to = modalStore.data.to as number;

	const newText = ref('');
	const isSaving = ref(false);

	onMounted(() => {
		const data = message.data;
		if (typeof data === 'string') {
			newText.value = data;
		} else if (data && typeof data === 'object') {
			if ('text' in data) {
				newText.value = (data as any).text || '';
			} else if ('replied' in data && 'data' in data) {
				newText.value = (data as any).data.text || '';
			}
		}
	});

	function close() {
		modalStore.closeModal();
	}

	async function save() {
		if (!newText.value.trim()) return;
		isSaving.value = true;
		try {
			if (!group_id) {
				const privateKey = await keyStore.get_private_key(to);
				const nonce = generate_nonce();
				const cipher = encrypt_message(privateKey, encode(newText.value), nonce);

				const messageData = {
					nonce,
					cipher,
				};

				await overwriteMessage(message.id, messageData as any);
			} else {
				await overwriteMessage(message.id, newText.value as any);
			}
			close();
		} catch (e) {
			console.error(e);
			errorStore.pushFrom(e, 'Failed to edit message.');
		} finally {
			isSaving.value = false;
		}
	}
</script>

<template>
	<div class="modal-backdrop" @click="close">
		<div class="modal-card" @click.stop>
			<header class="modal-header">
				<h2>Edit Message</h2>
				<button class="close-btn" @click="close">
					<Icon icon="mdi:close" />
				</button>
			</header>
			<div class="modal-body">
				<div class="input-group">
					<div class="input-wrapper textarea-wrapper">
						<textarea v-model="newText" rows="4" autofocus @keydown.enter.exact.prevent="save"></textarea>
					</div>
				</div>
			</div>
			<footer class="modal-footer">
				<button class="btn-secondary" @click="close">Cancel</button>
				<button class="btn-primary" :disabled="isSaving || !newText.trim()" @click="save">
					<Icon v-if="isSaving" icon="mdi:loading" class="spin" />
					<span v-else>Save</span>
				</button>
			</footer>
		</div>
	</div>
</template>

<style scoped>
	.modal-card {
		width: 440px;
		background-color: var(--bg);
		border-radius: 8px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.modal-header {
		padding: 16px 20px;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.modal-header h2 {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text);
		margin: 0;
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

	.modal-body {
		padding: 0 20px 20px;
	}

	.input-group {
		display: flex;
		flex-direction: column;
	}

	.input-wrapper {
		background-color: var(--bg-dark);
		border: 1px solid var(--border);
		border-radius: 6px;
		display: flex;
		align-items: center;
		transition: border-color 0.2s;
	}

	.input-wrapper:focus-within {
		border-color: var(--color);
	}

	.textarea-wrapper textarea {
		width: 100%;
		padding: 12px;
		background: transparent;
		border: none;
		color: var(--text);
		font-size: 0.95rem;
		outline: none;
		resize: none;
		min-height: 80px;
	}

	.modal-footer {
		padding: 16px 20px;
		background-color: var(--bg-dark);
		display: flex;
		justify-content: flex-end;
		gap: 12px;
	}

	.btn-secondary {
		background: none;
		border: none;
		color: var(--text);
		cursor: pointer;
		font-size: 0.9rem;
		font-weight: 500;
		padding: 8px 16px;
	}

	.btn-secondary:hover {
		text-decoration: underline;
	}

	.btn-primary {
		background-color: var(--color);
		color: white;
		border: none;
		border-radius: 4px;
		padding: 8px 20px;
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 6px;
		transition: background-color 0.2s;
	}

	.btn-primary:hover:not(:disabled) {
		background-color: var(--color-light);
	}

	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
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
