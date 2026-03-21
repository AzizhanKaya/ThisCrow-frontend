<script setup lang="ts">
	import { ref } from 'vue';
	import { Icon } from '@iconify/vue';
	import { useModalStore } from '@/stores/modal';
	import { websocketService } from '@/services/websocket';
	import { AckType, ChannelType, EventType, MessageType, type Ack, type Event, type Message, type id } from '@/types';
	import { useMeStore } from '@/stores/me';
	import { generate_snowflake } from '@/utils/snowflake';

	const modalStore = useModalStore();
	const meStore = useMeStore();

	const server_id = ref<id>(modalStore.data?.server_id ?? 0);
	const categoryName = ref('');
	const isLoading = ref(false);
	const error = ref<string | null>(null);

	const submitCreateCategory = async () => {
		if (!categoryName.value.trim()) return;
		if (!meStore.me) return;

		isLoading.value = true;
		error.value = null;

		try {
			const msg: Message<Event> = {
				id: generate_snowflake(),
				from: meStore.me!.id,
				to: server_id.value,
				group_id: server_id.value,
				type: MessageType.InfoGroup,
				data: {
					event: EventType.CreateChannel,
					payload: {
						name: 'general',
						is_voice: false,
						title: categoryName.value.trim(),
					},
				},
			};

			await websocketService.request(msg);

			categoryName.value = '';
			modalStore.closeModal();
		} catch (e: any) {
			error.value = e?.message ?? 'Failed to create category.';
		} finally {
			isLoading.value = false;
		}
	};
</script>

<template>
	<div class="modal-backdrop" @click="modalStore.closeModal">
		<div class="modal-container" @click.stop>
			<header class="modal-header">
				<div class="title-group">
					<h2>Create Category</h2>
					<span class="subtitle">Categories are a way to organize your channels.</span>
				</div>
				<button class="close-btn" @click="modalStore.closeModal">
					<Icon icon="mdi:close" />
				</button>
			</header>

			<div class="form-section">
				<div class="input-group">
					<label>CATEGORY NAME <span class="required">*</span></label>
					<div class="input-wrapper">
						<input
							type="text"
							v-model="categoryName"
							placeholder="new category"
							@keydown.enter="submitCreateCategory"
							maxlength="32"
							autoFocus
						/>
					</div>
				</div>
				<p v-if="error" class="error-msg">{{ error }}</p>
			</div>

			<footer class="modal-footer">
				<button class="btn-cancel" @click="modalStore.closeModal">Cancel</button>
				<button class="btn-create" :disabled="!categoryName.trim() || isLoading" @click="submitCreateCategory">
					<Icon v-if="isLoading" icon="eos-icons:loading" class="spin" />
					<span v-else>Create</span>
				</button>
			</footer>
		</div>
	</div>
</template>

<style scoped>
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		background-color: var(--overlay);
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.modal-container {
		background-color: var(--bg);
		width: 400px;
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

	.input-group label .required {
		color: var(--error, #f23f42);
	}

	.input-wrapper {
		position: relative;
		background-color: var(--bg-dark);
		border: 1px solid var(--border-muted);
		border-radius: 8px;
		padding: 0 14px;
		display: flex;
		align-items: center;
		transition: all 0.2s;
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
		font-size: 16px;
		outline: none;
	}

	.error-msg {
		margin: -10px 0 12px;
		font-size: 0.82rem;
		color: var(--error, #f23f42);
	}

	.modal-footer {
		background-color: var(--bg-dark);
		padding: 16px 24px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-top: 1px solid var(--border);
		margin-top: 10px;
	}

	.btn-cancel {
		background: none;
		border: none;
		color: var(--text);
		font-weight: 500;
		cursor: pointer;
		padding: 8px 12px;
		border-radius: 6px;
		transition: background-color 0.2s;
	}

	.btn-cancel:hover {
		text-decoration: underline;
	}

	.btn-create {
		background-color: var(--color);
		color: white;
		border: none;
		padding: 10px 24px;
		border-radius: 6px;
		font-weight: 600;
		font-size: 0.95rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s;
	}

	.btn-create:hover:not(:disabled) {
		background-color: var(--color-light);
		transform: translateY(-1px);
	}

	.btn-create:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.spin {
		animation: spin 1s linear infinite;
		font-size: 20px;
	}

	@keyframes spin {
		100% {
			transform: rotate(360deg);
		}
	}
</style>
