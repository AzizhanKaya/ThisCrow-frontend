<script setup lang="ts">
	import { ref } from 'vue';
	import { Icon } from '@iconify/vue';
	import { useModalStore } from '@/stores/modal';
	import { useServerStore } from '@/stores/server';
	import { websocketService } from '@/services/websocket';
	import { AckType, ChannelType, EventType, MessageType, type Ack, type Event, type Message, type id } from '@/types';
	import { useMeStore } from '@/stores/me';
	import { generate_snowflake } from '@/utils/snowflake';

	const modalStore = useModalStore();
	const serverStore = useServerStore();
	const meStore = useMeStore();

	const server_id = ref<id>(modalStore.data?.server_id ?? 0);

	const channelName = ref('');
	const categoryTitle = ref('');
	const channelType = ref<ChannelType>(ChannelType.Text);
	const isLoading = ref(false);
	const error = ref<string | null>(null);

	const submitCreateChannel = async () => {
		if (!channelName.value.trim()) return;
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
						name: channelName.value.trim(),
						is_voice: channelType.value === ChannelType.Voice,
						title: categoryTitle.value.trim() || undefined,
					},
				},
			};

			await websocketService.request(msg);

			channelName.value = '';
			channelType.value = ChannelType.Text;
			modalStore.closeModal();
		} catch (e: any) {
			error.value = e?.message ?? 'Failed to create channel.';
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
					<h2>Create Channel</h2>
					<span class="subtitle">Add a new text or voice channel to your server.</span>
				</div>
				<button class="close-btn" @click="modalStore.closeModal">
					<Icon icon="mdi:close" />
				</button>
			</header>

			<div class="form-section">
				<!-- Channel -->
				<div class="input-group">
					<div class="name">
						<label>CHANNEL NAME <span class="required">*</span></label>
						<div class="input-wrapper">
							<Icon :icon="channelType === ChannelType.Text ? 'lucide:hash' : 'mdi:volume-high'" class="input-prefix-icon" />
							<input type="text" v-model="channelName" placeholder="new channel" @keydown.enter="submitCreateChannel" maxlength="64" />
						</div>
					</div>
					<div class="title">
						<label>CATEGORY TITLE</label>
						<div class="input-wrapper">
							<input type="text" v-model="categoryTitle" placeholder="category" @keydown.enter="submitCreateChannel" maxlength="64" />
						</div>
					</div>
				</div>

				<!-- Channel Type Selector -->
				<div class="type-selector-group">
					<label>CHANNEL TYPE</label>
					<div class="type-selector">
						<button class="type-option" :class="{ active: channelType === ChannelType.Text }" @click="channelType = ChannelType.Text">
							<div class="type-icon">
								<Icon icon="glyphs:hash-bold" />
							</div>
							<div class="type-info">
								<span class="type-name">Text Channel</span>
								<span class="type-desc">Send messages, GIFs, and files</span>
							</div>
							<div class="type-check" v-if="channelType === ChannelType.Text">
								<Icon icon="material-symbols-light:check-circle" />
							</div>
						</button>

						<button class="type-option" :class="{ active: channelType === ChannelType.Voice }" @click="channelType = ChannelType.Voice">
							<div class="type-icon">
								<Icon icon="mdi:volume-high" />
							</div>
							<div class="type-info">
								<span class="type-name">Voice Channel</span>
								<span class="type-desc">Hang out with voice and video</span>
							</div>
							<div class="type-check" v-if="channelType === ChannelType.Voice">
								<Icon icon="material-symbols-light:check-circle" />
							</div>
						</button>
					</div>
				</div>

				<p v-if="error" class="error-msg">{{ error }}</p>
			</div>

			<footer class="modal-footer">
				<button class="btn-cancel" @click="modalStore.closeModal">Cancel</button>
				<button class="btn-create" :disabled="!channelName.trim() || isLoading" @click="submitCreateChannel">
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
		width: 460px;
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
		gap: 12px;
		flex-direction: column;
		margin-bottom: 20px;
	}

	label {
		display: block;
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--text-muted);
		margin-bottom: 8px;
	}

	label .required {
		color: var(--danger, #f23f42);
	}

	.type-selector-group {
		margin-bottom: 20px;
	}

	.type-selector {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.type-option {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 14px;
		background-color: var(--bg-dark);
		border: 1px solid var(--border-muted, var(--border));
		border-radius: 8px;
		cursor: pointer;
		text-align: left;
		width: 100%;
		transition:
			border-color 0.15s ease,
			background-color 0.15s ease;
	}

	.type-option:hover {
		background-color: var(--bg-darker, var(--bg-dark));
		border-color: var(--text-muted);
	}

	.type-option.active {
		border-color: var(--color);
		background-color: var(--bg-darker, var(--bg-dark));
	}

	.type-icon {
		font-size: 22px;
		color: var(--text-muted);
		flex-shrink: 0;
		display: flex;
		align-items: center;
	}

	.type-option.active .type-icon {
		color: var(--text);
	}

	.type-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
	}

	.type-name {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text);
	}

	.type-desc {
		font-size: 0.78rem;
		color: var(--text-muted);
	}

	.type-check {
		font-size: 20px;
		color: var(--color);
		flex-shrink: 0;
		display: flex;
		align-items: center;
	}

	.input-wrapper {
		position: relative;
		background-color: var(--bg-dark);
		border: 1px solid var(--border-muted, var(--border));
		border-radius: 8px;
		padding: 0 14px;
		display: flex;
		align-items: center;
		gap: 8px;
		transition: all 0.2s;
	}

	.input-wrapper:focus-within {
		border-color: var(--color);
		box-shadow: 0 0 0 2px rgba(114, 137, 218, 0.1);
	}

	.input-prefix-icon {
		font-size: 18px;
		color: var(--text-muted);
		flex-shrink: 0;
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
		color: var(--danger, #f23f42);
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
