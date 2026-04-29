<script setup lang="ts">
	import { ref, onMounted, onBeforeUnmount } from 'vue';
	import { Icon } from '@iconify/vue';
	import { type Message as MessageType, MessageType as MessageEnum, type id, type User, type MessageData } from '@/types';
	import { useFiles } from '@/composables/useFiles';
	import { useMessageStore } from '@/stores/message';
	import { useMeStore } from '@/stores/me';
	import { useKeyStore } from '@/stores/key';
	import { generate_snowflake } from '@/utils/snowflake';
	import { generate_nonce, encrypt_message } from '@/../pkg/wasm_lib';
	import { encode } from '@/utils/msgpack';

	const props = defineProps<{
		to: id;
		group_id?: id;
		type: MessageEnum;
	}>();

	const messageStore = useMessageStore();
	const meStore = useMeStore();
	const keyStore = useKeyStore();

	const input = ref('');

	const {
		fileInput,
		selectedFiles,
		hasSelectedFiles,
		isUploading,
		handleFileSelect: onFileSelect,
		addFiles,
		removeFile,
		clearFiles,
	} = useFiles();

	const isDragging = ref(false);
	let dragCounter = 0;

	function hasFilesInDrag(e: DragEvent): boolean {
		return !!e.dataTransfer?.types && Array.from(e.dataTransfer.types).includes('Files');
	}

	function onDragEnter(e: DragEvent) {
		if (!hasFilesInDrag(e)) return;
		e.preventDefault();
		dragCounter++;
		isDragging.value = true;
	}

	function onDragOver(e: DragEvent) {
		if (!hasFilesInDrag(e)) return;
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
	}

	function onDragLeave(e: DragEvent) {
		if (!hasFilesInDrag(e)) return;
		e.preventDefault();
		dragCounter = Math.max(0, dragCounter - 1);
		if (dragCounter === 0) isDragging.value = false;
	}

	async function onDrop(e: DragEvent) {
		if (!hasFilesInDrag(e)) return;
		e.preventDefault();
		dragCounter = 0;
		isDragging.value = false;

		const files = e.dataTransfer?.files;
		if (files && files.length > 0) {
			await addFiles(Array.from(files));
		}
	}

	onMounted(() => {
		window.addEventListener('dragenter', onDragEnter);
		window.addEventListener('dragover', onDragOver);
		window.addEventListener('dragleave', onDragLeave);
		window.addEventListener('drop', onDrop);
	});

	onBeforeUnmount(() => {
		window.removeEventListener('dragenter', onDragEnter);
		window.removeEventListener('dragover', onDragOver);
		window.removeEventListener('dragleave', onDragLeave);
		window.removeEventListener('drop', onDrop);
	});

	let sending = false;

	async function onSend() {
		if (sending || isUploading.value) return;
		sending = true;

		try {
			const text = input.value.trim();

			const hasFiles =
				selectedFiles.value.images.length > 0 || selectedFiles.value.videos.length > 0 || selectedFiles.value.files.length > 0;

			if (!text && !hasFiles) return;

			let messageData: MessageData =
				text && !hasFiles
					? text
					: {
							...(text && { text }),
							...(selectedFiles.value.images.length > 0 && {
								images: selectedFiles.value.images.map((img) => img.uploadedUrl!),
							}),
							...(selectedFiles.value.videos.length > 0 && {
								videos: selectedFiles.value.videos.map((vid) => vid.uploadedUrl!),
							}),
							...(selectedFiles.value.files.length > 0 && {
								files: selectedFiles.value.files.map((f) => ({
									url: f.url,
									name: f.name,
									size: f.size,
								})),
							}),
						};

			if (!props.group_id) {
				const privateKey = await keyStore.get_private_key(props.to);
				const nonce = generate_nonce();
				const cipher = encrypt_message(privateKey, encode(messageData), nonce);

				messageData = { nonce, cipher };
			}

			const message: MessageType = {
				id: generate_snowflake(),
				from: meStore.me!.id,
				to: props.to,
				group_id: props.group_id,
				data: messageData,
				type: props.type,
			};

			messageStore.sendMessage(message);
			input.value = '';

			clearFiles();
		} finally {
			sending = false;
		}
	}

	function onPlus() {
		fileInput.value?.click();
	}
</script>

<template>
	<Teleport to="body">
		<Transition name="drop-fade">
			<div v-if="isDragging" class="drop-overlay">
				<div class="drop-zone">
					<div class="drop-icon-wrap">
						<Icon icon="mdi:tray-arrow-up" class="drop-icon" />
					</div>
					<div class="drop-title">Drop files here</div>
					<div class="drop-sub">Images, videos or files</div>
				</div>
			</div>
		</Transition>
	</Teleport>

	<div class="input-area">
		<div class="input-container">
			<div v-if="hasSelectedFiles" class="file-previews">
				<div v-for="(img, index) in selectedFiles.images" :key="img.id" class="preview-item">
					<img :src="img.url" class="preview-image" :class="{ 'is-uploading': img.uploading }" />
					<div v-if="img.uploading" class="preview-overlay">
						<Icon icon="mdi:loading" class="spinner" />
					</div>
					<div v-else-if="img.failed" class="preview-overlay error">
						<Icon icon="mdi:alert-circle" />
					</div>
					<button class="remove-file" @click="removeFile('images', index)">
						<Icon icon="mdi:close" />
					</button>
				</div>
				<div v-for="(vid, index) in selectedFiles.videos" :key="vid.id" class="preview-item">
					<video :src="vid.url" class="preview-video" :class="{ 'is-uploading': vid.uploading }" />
					<div v-if="vid.uploading" class="preview-overlay">
						<Icon icon="mdi:loading" class="spinner" />
					</div>
					<div v-else-if="vid.failed" class="preview-overlay error">
						<Icon icon="mdi:alert-circle" />
					</div>
					<button class="remove-file" @click="removeFile('videos', index)">
						<Icon icon="mdi:close" />
					</button>
				</div>
				<div v-for="(file, index) in selectedFiles.files" :key="file.id" class="preview-item file-preview">
					<Icon
						v-if="file.uploading"
						icon="mdi:loading"
						class="spinner file-status-icon"
					/>
					<Icon
						v-else-if="file.failed"
						icon="mdi:alert-circle"
						class="file-status-icon error"
					/>
					<Icon v-else icon="mdi:file" class="file-status-icon" />
					<div class="file-info">
						<span class="file-name">{{ file.name }}</span>
						<span class="file-size">
							{{ file.uploading ? 'Uploading…' : file.failed ? 'Failed' : file.size }}
						</span>
					</div>
					<button class="remove-file static" @click="removeFile('files', index)">
						<Icon icon="mdi:close" />
					</button>
				</div>
			</div>
			<div class="input-row">
				<input
					type="file"
					ref="fileInput"
					@change="onFileSelect"
					multiple
					accept="image/*,video/*,application/*"
					style="display: none"
				/>
				<button class="icon-btn plus" @click="onPlus" aria-label="Add">
					<Icon icon="mdi:plus" width="24" height="24" />
				</button>
				<input type="text" v-model="input" placeholder="Type a message..." @keydown.enter="onSend" />
				<button
					class="icon-btn send"
					:class="{ active: (input.length > 0 || hasSelectedFiles) && !isUploading }"
					@click="onSend"
					:disabled="(!input.length && !hasSelectedFiles) || isUploading"
					:title="isUploading ? 'Uploading…' : ''"
				>
					<Icon v-if="isUploading" icon="mdi:loading" class="spinner" width="24" height="24" />
					<Icon v-else icon="mdi:send" width="24" height="24" />
				</button>
			</div>
		</div>
	</div>
</template>

<style>
	.input-area {
		position: absolute;
		bottom: 15px;
		width: 100%;
		padding: 0 20px;
		z-index: 10;
	}

	.input-container {
		width: 100%;
		background-color: var(--bg-dark);
		border-radius: 16px;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.file-previews {
		padding: 10px;
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		border-bottom: 1px solid #303030;
		color: white;
	}

	.preview-item {
		position: relative;
		border-radius: 6px;
		overflow: hidden;
		display: flex;
		align-items: center;
	}

	.preview-image,
	.preview-video {
		max-width: 160px;
		max-height: 100px;
		width: auto;
		height: auto;
		display: block;
		border-radius: 6px;
	}

	.preview-image.is-uploading,
	.preview-video.is-uploading {
		filter: brightness(0.55);
	}

	.preview-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
		font-size: 1.5rem;
		pointer-events: none;
	}

	.preview-overlay.error {
		color: #ff6b6b;
	}

	.file-preview {
		background: var(--bg-darker);
		border: 1px solid var(--border);
		padding: 8px 10px;
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 10px;
		min-width: 200px;
		max-width: 320px;
		border-radius: 8px;
	}

	.file-preview .file-info {
		display: flex;
		flex-direction: column;
		min-width: 0;
		flex: 1;
		gap: 2px;
	}

	.file-preview .file-name {
		color: var(--text);
		font-size: 0.9rem;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.file-preview .file-size {
		font-size: 0.75rem;
		color: var(--text-subtle);
	}

	.file-status-icon {
		font-size: 1.5rem;
		color: var(--text-secondary);
		flex-shrink: 0;
	}

	.file-status-icon.error {
		color: #ff6b6b;
	}

	.remove-file {
		position: absolute;
		top: 4px;
		right: 4px;
		background: rgba(0, 0, 0, 0.5);
		border: none;
		color: white;
		border-radius: 50%;
		width: 20px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		padding: 0;
	}

	.remove-file.static {
		position: static;
		background: transparent;
		color: var(--text-subtle);
	}

	.remove-file.static:hover {
		color: var(--text);
	}

	.remove-file:hover {
		background: rgba(0, 0, 0, 0.7);
	}

	.spinner {
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

	.drop-overlay {
		position: fixed;
		inset: 0;
		z-index: 1500;
		background-color: rgba(0, 0, 0, 0.72);
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
		font-family: Arial, Helvetica, sans-serif;
	}

	.drop-zone {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 14px;
		padding: 56px 80px;
		border-radius: 16px;
		border: 1.5px solid var(--color);
		background-color: var(--bg-darker);
		box-shadow:
			0 0 0 1px hsla(261, 68%, 45%, 0.2),
			0 0 40px hsla(261, 68%, 45%, 0.15),
			0 16px 48px rgba(0, 0, 0, 0.6);
	}

	.drop-icon-wrap {
		width: 72px;
		height: 72px;
		border-radius: 50%;
		background-color: hsla(261, 68%, 45%, 0.18);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.drop-icon {
		font-size: 2.2rem;
		color: var(--color-lighter);
	}

	.drop-title {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text);
		letter-spacing: 0.3px;
	}

	.drop-sub {
		font-size: 0.88rem;
		color: var(--text-muted);
	}

	.drop-fade-enter-active,
	.drop-fade-leave-active {
		transition: opacity 0.15s ease;
	}

	.drop-fade-enter-from,
	.drop-fade-leave-to {
		opacity: 0;
	}

	.input-row {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 8px;
	}

	.icon-btn {
		background: none;
		border: none;
		color: #888;
		font-size: 24px;
		cursor: pointer;
		user-select: none;
		transition: color 0.3s;
		padding: 0;
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.icon-btn:hover {
		color: var(--text);
	}

	.icon-btn.send.active {
		color: var(--text);
		cursor: pointer;
	}

	.icon-btn.send:disabled {
		color: #555;
	}

	.input-row > input {
		flex: 1;
		border: none;
		background: transparent;
		color: white;
		font-size: 1rem;
		outline: none;
		padding: 0;
		margin: 0;
		min-width: 0;
	}
</style>
