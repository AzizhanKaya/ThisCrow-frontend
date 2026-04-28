<script setup lang="ts">
	import { ref } from 'vue';
	import { Icon } from '@iconify/vue';
	import { useModalStore } from '@/stores/modal';
	import { useServerStore } from '@/stores/server';
	import { websocketService } from '@/services/websocket';
	import { AckType, MessageType, type Ack, type id, type Message } from '@/types';
	import { useRouter } from 'vue-router';
	import { useFiles } from '@/composables/useFiles';

	const router = useRouter();
	const modalStore = useModalStore();
	const serverStore = useServerStore();
	const { uploadFiles } = useFiles();

	const serverName = ref('');
	const serverDescription = ref<string | undefined>(undefined);
	const serverIcon = ref<string | undefined>(undefined);
	const serverIconPreview = ref<string | null>(null);
	const fileInput = ref<HTMLInputElement | null>(null);
	const isUploadingIcon = ref(false);

	const isLoading = ref(false);

	const handleFileUpload = async (event: Event) => {
		const target = event.target as HTMLInputElement;
		if (target.files && target.files[0]) {
			const file = target.files[0];

			serverIconPreview.value = URL.createObjectURL(file);

			isUploadingIcon.value = true;
			try {
				const uploaded = await uploadFiles([file], 'icon');
				if (uploaded.length > 0) {
					serverIcon.value = uploaded[0].url;
				}
			} catch (e) {
				console.error('Icon upload failed:', e);
				serverIconPreview.value = null;
				serverIcon.value = undefined;
			} finally {
				isUploadingIcon.value = false;
				if (target) target.value = '';
			}
		}
	};

	const triggerFileInput = () => {
		fileInput.value?.click();
	};

	const submitCreateServer = async () => {
		if (!serverName.value.trim()) return;

		isLoading.value = true;
		try {
			const server_id = (await serverStore.createServer(serverName.value, serverDescription.value, serverIcon.value)).from;

			isLoading.value = false;
			serverName.value = '';
			serverDescription.value = undefined;
			serverIcon.value = undefined;
			serverIconPreview.value = null;
			modalStore.closeModal();

			router.push({ name: 'server', params: { serverId: server_id.toString() } });
		} catch (e) {
			console.error(e);
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
					<h2>Create Server</h2>
					<span class="subtitle">Give your new server a personality with a name and an icon.</span>
				</div>
				<button class="close-btn" @click="modalStore.closeModal">
					<Icon icon="mdi:close" />
				</button>
			</header>

			<div class="form-section">
				<!-- Icon Upload -->
				<div class="icon-upload-container">
					<div class="icon-upload-preview" @click="triggerFileInput">
						<img v-if="serverIconPreview" :src="serverIconPreview" alt="Server Icon Preview" class="preview-img" />
						<div v-else class="preview-placeholder">
							<Icon icon="mdi:camera-plus" class="camera-icon" />
							<span class="upload-text">UPLOAD</span>
						</div>

						<div v-if="isUploadingIcon" class="hover-overlay" style="opacity: 1">
							<Icon icon="eos-icons:loading" class="spin" />
						</div>
						<div v-else-if="serverIconPreview" class="hover-overlay">
							<Icon icon="mdi:image-edit" />
						</div>
					</div>
					<input type="file" accept="image/*" ref="fileInput" @change="handleFileUpload" hidden />
				</div>

				<!-- Name Input -->
				<div class="input-group">
					<label>SERVER NAME <span class="required">*</span></label>
					<div class="input-wrapper">
						<input type="text" v-model="serverName" placeholder="My Awesome Server" />
					</div>
				</div>

				<!-- Description Input -->
				<div class="input-group">
					<label>DESCRIPTION </label>
					<div class="input-wrapper textarea-wrapper">
						<textarea v-model="serverDescription" placeholder="What is this server about?" rows="3"></textarea>
					</div>
				</div>
			</div>

			<footer class="modal-footer">
				<button class="btn-cancel" @click="modalStore.closeModal">Cancel</button>
				<button class="btn-create" :disabled="!serverName.trim() || isLoading || isUploadingIcon" @click="submitCreateServer">
					<Icon v-if="isLoading" icon="eos-icons:loading" class="spin" />
					<span v-else>Create</span>
				</button>
			</footer>
		</div>
	</div>
</template>

<style scoped>
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
		margin: 0;
		font-size: 1.3rem;
		color: var(--text);
		font-weight: 700;
		letter-spacing: 0.5px;
		margin-bottom: 6px;
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
		padding: 10px 24px 0px;
	}

	.icon-upload-container {
		display: flex;
		justify-content: center;
		margin-bottom: 24px;
		margin-top: 10px;
	}

	.icon-upload-preview {
		width: 80px;
		height: 80px;
		border-radius: 50%;
		background-color: var(--bg-dark);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		position: relative;
		overflow: hidden;
	}

	.icon-upload-preview::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		border-radius: 50%;
		border: 2px dashed var(--border);
		transition: transform 0.3s ease;
		pointer-events: none;
	}

	.icon-upload-preview:hover::before {
		transform: rotate(30deg);
		border-color: var(--bg-light);
	}
	.preview-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		color: var(--text-muted);
	}

	.camera-icon {
		font-size: 24px;
		margin-bottom: 4px;
		color: var(--text-muted);
	}

	.upload-text {
		font-size: 0.65rem;
		font-weight: 700;
		letter-spacing: 0.5px;
	}

	.preview-img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.hover-overlay {
		position: absolute;
		inset: 0;
		background-color: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
		font-size: 24px;
		opacity: 0;
		transition: opacity 0.2s;
	}

	.icon-upload-preview:hover .hover-overlay {
		opacity: 1;
	}

	/* Input Group Styles */
	.input-group {
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
		color: var(--danger, #f23f42);
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

	.textarea-wrapper {
		padding: 0;
	}

	.textarea-wrapper textarea {
		width: 100%;
		padding: 14px;
		background: transparent;
		border: none;
		color: var(--text);
		font-size: 16px;
		outline: none;
		resize: none;
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
		background-color: var(--bg);
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
		min-width: 100px;
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
