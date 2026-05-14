<script setup lang="ts">
	import { ref, onMounted, computed } from 'vue';
	import { useServerStore } from '@/stores/server';
	import { useErrorStore } from '@/stores/error';
	import { useModalStore, ModalView } from '@/stores/modal';
	import { useMeStore } from '@/stores/me';
	import { useFiles } from '@/composables/useFiles';
	import { Icon } from '@iconify/vue';
	import type { id } from '@/types';
	import { useRouter } from 'vue-router';

	const props = defineProps<{
		serverId: id;
	}>();

	const serverStore = useServerStore();
	const errorStore = useErrorStore();
	const modalStore = useModalStore();
	const router = useRouter();
	const meStore = useMeStore();
	const { uploadFiles } = useFiles();

	const server = computed(() => serverStore.getServerById(props.serverId));
	const isOwner = computed(() => server.value?.owner === meStore.me?.id);

	const serverName = ref(server.value?.name || '');
	const serverDescription = ref(server.value?.description || '');
	const serverIcon = ref(server.value?.icon || '');
	const serverIconPreview = ref<string | null>(server.value?.icon || null);
	const iconFileInput = ref<HTMLInputElement | null>(null);
	const isUploadingIcon = ref(false);
	const isSaving = ref(false);

	const hasGeneralChanges = computed(() => {
		if (!server.value) return false;
		return (
			serverName.value !== server.value.name ||
			serverDescription.value !== (server.value.description || '') ||
			serverIcon.value !== (server.value.icon || '')
		);
	});

	const triggerIconUpload = () => {
		iconFileInput.value?.click();
	};

	const handleIconUpload = async (event: Event) => {
		const files = (event.target as HTMLInputElement).files;
		if (!files || !files[0]) return;

		const file = files[0];
		serverIconPreview.value = URL.createObjectURL(file);

		isUploadingIcon.value = true;
		try {
			const uploaded = await uploadFiles([file], 'icon');
			if (uploaded.length > 0) {
				serverIcon.value = uploaded[0].url;
			}
		} catch (e) {
			console.error('Icon upload failed:', e);
			errorStore.pushFrom(e, 'Icon upload failed.');
			serverIconPreview.value = serverIcon.value || null;
		} finally {
			isUploadingIcon.value = false;
			if (iconFileInput.value) iconFileInput.value.value = '';
		}
	};

	async function saveGeneralSettings() {
		if (!props.serverId) return;
		isSaving.value = true;
		try {
			await serverStore.updateServer(props.serverId, serverName.value, serverDescription.value, serverIcon.value || undefined);
		} finally {
			isSaving.value = false;
		}
	}

	function confirmDeleteServer() {
		modalStore.openModal(ModalView.CONFIRM, {
			icon: 'mdi:delete-alert',
			title: `Delete '${server.value?.name}'`,
			text:
				'Are you sure you want to delete this server? This action is irreversible and all channels, messages, and data will be permanently lost.',
			command: async () => {
				await serverStore.deleteServer(props.serverId);
				router.push({ name: 'chats' });
			},
		});
	}
</script>

<template>
	<div class="content-scroll">
		<h2 class="content-title">Server General</h2>

		<div class="input-group">
			<label>ICON</label>
			<div class="icon-upload-row">
				<div class="icon-upload-preview" @click="triggerIconUpload">
					<img v-if="serverIconPreview" :src="serverIconPreview" class="preview-img" />
					<div v-else class="preview-placeholder">
						<Icon icon="mdi:camera-plus" class="camera-icon" />
					</div>
					<div v-if="isUploadingIcon" class="icon-hover-overlay" style="opacity: 1">
						<Icon icon="eos-icons:loading" class="spin" />
					</div>
					<div v-else-if="serverIconPreview" class="icon-hover-overlay">
						<Icon icon="mdi:image-edit" />
					</div>
				</div>
			</div>
			<input type="file" accept="image/*" ref="iconFileInput" @change="handleIconUpload" hidden />
		</div>

		<div class="input-group">
			<label>SERVER NAME <span class="req">*</span></label>
			<div class="input-wrapper">
				<input type="text" v-model="serverName" />
			</div>
		</div>

		<div class="input-group">
			<label>DESCRIPTION</label>
			<div class="input-wrapper textarea-wrapper">
				<textarea v-model="serverDescription" rows="4"></textarea>
			</div>
		</div>

		<div v-if="isOwner" class="danger-zone">
			<div class="danger-zone-header">
				<Icon icon="mdi:alert-circle" class="danger-icon" />
				<span>DANGER ZONE</span>
			</div>
			<div class="danger-zone-content">
				<div class="danger-info">
					<span class="danger-title">Delete Server</span>
					<span class="danger-desc">Once deleted, there is no going back. All data will be permanently removed.</span>
				</div>
				<button class="btn-danger" @click="confirmDeleteServer">
					<Icon icon="mdi:delete" />
					Delete Server
				</button>
			</div>
		</div>
	</div>

	<Transition name="save-bar">
		<div v-if="hasGeneralChanges" class="save-bar">
			<button class="btn-primary" :disabled="isSaving" @click="saveGeneralSettings()">
				<Icon v-if="isSaving" icon="mdi:loading" class="spin" />
				<span v-else>Save Changes</span>
			</button>
		</div>
	</Transition>
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

	.icon-upload-row {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.icon-upload-preview {
		width: 64px;
		height: 64px;
		border-radius: 50%;
		background-color: var(--bg-dark);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		position: relative;
		overflow: hidden;
		flex-shrink: 0;
		border: 2px solid var(--border);
		transition: border-color 0.2s;
	}

	.icon-upload-preview .preview-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		border-radius: 50%;
	}

	.icon-upload-preview .preview-placeholder {
		color: var(--text-muted);
	}

	.icon-upload-preview .camera-icon {
		font-size: 24px;
	}

	.icon-hover-overlay {
		position: absolute;
		background-color: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
		font-size: 20px;
		opacity: 0;
		transition: opacity 0.2s;
		border-radius: 50%;
		inset: 0;
	}

	.icon-upload-preview:hover .icon-hover-overlay {
		opacity: 1;
	}

	.input-group {
		display: flex;
		flex-direction: column;
		margin-bottom: 20px;
	}

	.input-group label {
		font-size: 0.72rem;
		font-weight: 700;
		color: var(--text-muted);
		margin-bottom: 8px;
		letter-spacing: 0.3px;
	}

	.req {
		color: var(--danger, #f23f42);
	}

	.input-wrapper {
		background-color: var(--bg-dark);
		border: 1px solid var(--border-muted);
		border-radius: 8px;
		padding: 0 14px;
		display: flex;
		align-items: center;
		transition:
			border-color 0.2s,
			box-shadow 0.2s;
	}

	.input-wrapper:focus-within {
		border-color: var(--color);
		box-shadow: 0 0 0 2px rgba(114, 137, 218, 0.12);
	}

	.input-wrapper input {
		width: 100%;
		padding: 12px 0;
		background: transparent;
		border: none;
		color: var(--text);
		font-size: 15px;
		outline: none;
	}

	.textarea-wrapper {
		padding: 0;
	}

	.textarea-wrapper textarea {
		width: 100%;
		padding: 12px 14px;
		background: transparent;
		border: none;
		color: var(--text);
		font-size: 15px;
		outline: none;
		resize: none;
	}

	/* ===== Danger Zone ===== */
	.danger-zone {
		margin-top: 32px;
		border: 1px solid rgba(242, 63, 66, 0.35);
		border-radius: 10px;
		overflow: hidden;
	}

	.danger-zone-header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 16px;
		background-color: rgba(242, 63, 66, 0.08);
		font-size: 0.72rem;
		font-weight: 700;
		color: var(--error, #f23f42);
		letter-spacing: 0.4px;
	}

	.danger-icon {
		font-size: 1rem;
	}

	.danger-zone-content {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px;
		gap: 16px;
	}

	.danger-info {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.danger-title {
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--text);
	}

	.danger-desc {
		font-size: 0.82rem;
		color: var(--text-muted);
		line-height: 1.4;
	}

	.btn-danger {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 9px 18px;
		border-radius: 6px;
		border: 1px solid var(--error, #f23f42);
		background: transparent;
		color: var(--error, #f23f42);
		font-weight: 600;
		font-size: 0.85rem;
		cursor: pointer;
		white-space: nowrap;
		transition: all 0.2s;
	}

	.btn-danger:hover {
		background-color: var(--error, #f23f42);
		color: white;
	}

	.spin {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		100% {
			transform: rotate(360deg);
		}
	}

	.save-bar {
		position: absolute;
		bottom: 0;
		right: 0;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 16px;
		padding: 14px 28px;
		z-index: 5;
	}

	.btn-primary {
		background-color: var(--color);
		color: white;
		border: none;
		padding: 10px 24px;
		border-radius: 6px;
		font-weight: 600;
		font-size: 0.9rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 6px;
		transition: all 0.2s;
	}

	.btn-primary:hover:not(:disabled) {
		background-color: var(--color-light);
		transform: translateY(-1px);
	}

	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.save-bar-enter-active,
	.save-bar-leave-active {
		transition:
			transform 0.1s ease-in,
			opacity 0.1s ease-in-out;
	}

	.save-bar-enter-from,
	.save-bar-leave-to {
		transform: translateY(100%);
		opacity: 0;
	}
</style>
