<script setup lang="ts">
	import { ref } from 'vue';
	import { Icon } from '@iconify/vue';
	import { type Message as MessageType, MessageType as MessageEnum, type id, type User } from '@/types';
	import { useFiles } from '@/composables/useFiles';
	import { useMessageStore, generateTempId } from '@/stores/message';
	import { useMeStore } from '@/stores/me';

	const props = defineProps<{
		to: id;
		group_id?: id;
		type: MessageEnum;
	}>();

	const messageStore = useMessageStore();
	const meStore = useMeStore();

	const input = ref('');

	const { fileInput, selectedFiles, hasSelectedFiles, handleFileSelect: onFileSelect, removeFile, clearFiles } = useFiles();

	function onSend() {
		if (input.value.trim() === '' && !hasSelectedFiles.value) return;

		const messageData = {
			...(input.value.trim() !== '' && { text: input.value }),
			...(selectedFiles.value.images.length > 0 && {
				images: selectedFiles.value.images.map((img) => img.url),
			}),
			...(selectedFiles.value.videos.length > 0 && {
				videos: selectedFiles.value.videos.map((vid) => vid.url),
			}),
			...(selectedFiles.value.files.length > 0 && {
				files: selectedFiles.value.files.map((f) => ({ url: f.url, name: f.name, size: f.size })),
			}),
		};

		const message: MessageType = {
			id: generateTempId(),
			from: meStore.me!.id,
			to: props.to,
			group_id: props.group_id,
			data: messageData,
			type: props.type,
			time: new Date(),
		};

		messageStore.sendMessage(message);

		input.value = '';
		clearFiles();
	}

	function onPlus() {
		fileInput.value?.click();
	}
</script>

<template>
	<div class="input-area">
		<div class="input-container">
			<div v-if="hasSelectedFiles" class="file-previews">
				<div v-for="(img, index) in selectedFiles.images" :key="img.url" class="preview-item">
					<img :src="img.url" class="preview-image" />
					<button class="remove-file" @click="removeFile('images', index)">
						<Icon icon="mdi:close" />
					</button>
				</div>
				<div v-for="(vid, index) in selectedFiles.videos" :key="vid.url" class="preview-item">
					<video :src="vid.url" class="preview-video" />
					<button class="remove-file" @click="removeFile('videos', index)">
						<Icon icon="mdi:close" />
					</button>
				</div>
				<div v-for="(file, index) in selectedFiles.files" :key="file.name" class="preview-item file-preview">
					<span class="file-name">{{ file.name }}</span>
					<span class="file-size">{{ file.size }}</span>
					<button class="remove-file" @click="removeFile('files', index)">
						<Icon icon="mdi:close" />
					</button>
				</div>
			</div>
			<div class="input-row">
				<input type="file" ref="fileInput" @change="onFileSelect" multiple accept="image/*,video/*,application/*" style="display: none" />
				<button class="icon-btn plus" @click="onPlus" aria-label="Add">
					<Icon icon="mdi:plus" width="24" height="24" />
				</button>
				<input type="text" v-model="input" placeholder="Type a message..." @keydown.enter="onSend" />
				<button
					class="icon-btn send"
					:class="{ active: input.length > 0 || hasSelectedFiles }"
					@click="onSend"
					:disabled="!input.length && !hasSelectedFiles"
				>
					<Icon icon="mdi:send" width="24" height="24" />
				</button>
			</div>
		</div>
	</div>
</template>

<style>
	.input-area {
		position: absolute;
		bottom: 30px;
		width: 100%;
		padding: 0 20px;
		z-index: 10;
	}

	.input-container {
		width: 100%;
		background-color: #222;
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
		border-radius: 4px;
		overflow: hidden;
	}

	.preview-image,
	.preview-video {
		width: 80px;
		height: 80px;
		object-fit: cover;
	}

	.file-preview {
		background: rgba(255, 255, 255, 0.05);
		padding: 8px;
		display: flex;
		flex-direction: column;
		min-width: 120px;
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

	.remove-file:hover {
		background: rgba(0, 0, 0, 0.7);
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
