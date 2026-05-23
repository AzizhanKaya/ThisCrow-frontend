<script setup lang="ts">
	import { ref, onMounted, onBeforeUnmount, watch, computed, nextTick } from 'vue';
	import { computedAsync } from '@vueuse/core';
	import { Icon } from '@iconify/vue';
	import EmojiPicker from '@/components/EmojiPicker.vue';
	import {
		type Message as MessageType,
		MessageType as MessageEnum,
		type id,
		type User,
		type MessageData,
		type MultiData,
		type snowflake_id,
	} from '@/types';
	import { useFiles } from '@/composables/useFiles';
	import { useMessageStore, type ChatTarget } from '@/stores/message';
	import { useMeStore } from '@/stores/me';
	import { useUserStore } from '@/stores/user';
	import { useKeyStore } from '@/stores/key';
	import { summarizeMessageData, type MessageSummary } from '@/utils/messagePreview';
	import { generate_snowflake } from '@/utils/snowflake';
	import { generate_nonce, encrypt_message } from '@/../pkg/wasm_lib';
	import { encode } from '@/utils/msgpack';

	const props = defineProps<{
		to: id;
		group_id?: id;
		type: MessageEnum;
		replyTo?: snowflake_id | null;
	}>();

	const emit = defineEmits<{
		(e: 'clear-reply'): void;
	}>();

	const messageStore = useMessageStore();
	const meStore = useMeStore();
	const userStore = useUserStore();
	const keyStore = useKeyStore();

	const chatTarget = $computed<ChatTarget>(() =>
		props.group_id ? { kind: 'channel', channel_id: props.to, group_id: props.group_id } : { kind: 'user', user_id: props.to }
	);

	const repliedPreview = $(
		computedAsync(async () => {
			if (props.replyTo == null) return null;

			const msg = await messageStore.findMessage(chatTarget, props.replyTo);
			if (!msg) {
				return { user: null, snippet: { text: '(message unavailable)' } as MessageSummary };
			}

			let privateKey: Uint8Array | null = null;
			if (!props.group_id) {
				try {
					privateKey = await keyStore.get_private_key(props.to);
				} catch {
					privateKey = null;
				}
			}

			return {
				user: (await userStore.getUser(msg.from)) ?? null,
				snippet: summarizeMessageData(msg.data, privateKey),
			};
		}, null)
	);

	const input = ref('');
	const textarea = ref<HTMLTextAreaElement | null>(null);

	function autoResize() {
		const el = textarea.value;
		if (!el) return;
		el.style.height = 'auto';
		el.style.height = Math.min(el.scrollHeight, 240) + 'px';
	}

	watch(input, () => nextTick(autoResize));

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
			e.preventDefault();
			onSend();
		}
	}

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

			if (props.replyTo != null) {
				const inner: MultiData = typeof messageData === 'string' ? { text: messageData } : (messageData as MultiData);
				messageData = { replied: props.replyTo, data: inner };
			}

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
			if (props.replyTo != null) emit('clear-reply');
		} finally {
			sending = false;
		}
	}

	function cancelReply() {
		emit('clear-reply');
	}

	function onPlus() {
		fileInput.value?.click();
	}

	const showEmojiPicker = ref(false);
	const emojiBtnRef = ref<HTMLElement | null>(null);

	function toggleEmojiPicker() {
		showEmojiPicker.value = !showEmojiPicker.value;
	}

	function onEmojiSelect(emoji: string) {
		const el = textarea.value;
		if (!el) {
			input.value += emoji;
			return;
		}
		const start = el.selectionStart ?? input.value.length;
		const end = el.selectionEnd ?? input.value.length;
		input.value = input.value.slice(0, start) + emoji + input.value.slice(end);
		nextTick(() => {
			el.focus();
			const pos = start + emoji.length;
			el.setSelectionRange(pos, pos);
		});
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
			<Transition name="slide-down">
				<div v-if="replyTo != null" class="reply-banner">
					<div class="reply-accent"></div>
					<Icon icon="mdi:reply" class="reply-icon" />
					<div class="reply-text">
						<div class="reply-header">
							<span class="reply-label">Replying to</span>
							<span class="reply-username">@{{ repliedPreview?.user?.username ?? '…' }}</span>
						</div>
						<div class="reply-snippet">
							<template v-if="repliedPreview?.snippet?.text">{{ repliedPreview.snippet.text }}</template>
							<template v-else-if="!repliedPreview?.snippet?.icons?.length">…</template>
							<Icon v-for="icon in repliedPreview?.snippet?.icons" :key="icon" :icon="icon" class="reply-snippet-icon" />
						</div>
					</div>
					<button class="reply-close" @click="cancelReply" aria-label="Cancel reply" title="Cancel reply">
						<Icon icon="mdi:close" />
					</button>
				</div>
			</Transition>
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
					<Icon v-if="file.uploading" icon="mdi:loading" class="spinner file-status-icon" />
					<Icon v-else-if="file.failed" icon="mdi:alert-circle" class="file-status-icon error" />
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
				<textarea ref="textarea" v-model="input" placeholder="Type a message..." rows="1" @keydown="onKeydown" />
				<button class="icon-btn" ref="emojiBtnRef" @click="toggleEmojiPicker" aria-label="Emoji" title="Emoji">
					<Icon icon="mdi:emoticon-outline" width="24" height="24" />
				</button>
				<EmojiPicker
					v-if="showEmojiPicker"
					:anchor="emojiBtnRef"
					@select="onEmojiSelect"
					@close="showEmojiPicker = false"
				/>
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
		bottom: 8px;
		width: 100%;
		padding: 0 8px;
		z-index: 300;
	}

	.input-container {
		width: 100%;
		background-color: var(--bg-dark);
		border-radius: 8px;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		max-height: 400px;
	}

	.input-container::-webkit-scrollbar {
		width: 4px;
	}

	.input-container::-webkit-scrollbar-thumb {
		background: #444;
		border-radius: 4px;
	}

	.input-container::-webkit-scrollbar-track {
		background: transparent;
	}

	.file-previews {
		padding: 10px;
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		border-bottom: 1px solid #303030;
		color: white;
		max-height: 240px;
		overflow-y: auto;
	}

	.file-previews::-webkit-scrollbar {
		width: 4px;
	}

	.file-previews::-webkit-scrollbar-thumb {
		background: #444;
		border-radius: 4px;
	}

	.reply-banner {
		position: relative;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 12px 8px 14px;
		border-bottom: 1px solid #303030;
		color: var(--text-muted);
		font-size: 0.85rem;
	}

	.reply-accent {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 3px;
		background: var(--color-lighter);
	}

	.reply-icon {
		font-size: 1.1rem;
		color: var(--color-lighter);
		flex-shrink: 0;
		transform: scaleX(-1);
	}

	.reply-text {
		display: flex;
		flex-direction: column;
		gap: 1px;
		flex: 1;
		min-width: 0;
		line-height: 1.25;
	}

	.reply-header {
		display: flex;
		align-items: baseline;
		gap: 5px;
		min-width: 0;
	}

	.reply-label {
		color: var(--text-muted);
		font-size: 0.78rem;
	}

	.reply-username {
		color: var(--text);
		font-weight: 600;
		font-size: 0.85rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}

	.reply-snippet {
		display: flex;
		align-items: center;
		gap: 4px;
		color: var(--text-secondary);
		font-size: 0.8rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}

	.reply-snippet-icon {
		font-size: 0.9rem;
		flex-shrink: 0;
	}

	.reply-close {
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		font-size: 1.1rem;
		border-radius: 6px;
		flex-shrink: 0;
		transition:
			color 0.15s ease,
			background 0.15s ease;
	}

	.reply-close:hover {
		color: var(--text);
		background: var(--bg-light);
	}

	.preview-item {
		position: relative;
		border-radius: 8px;
		overflow: hidden;
		display: flex;
		align-items: center;
		background: var(--bg-darker);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		border: 1px solid rgba(255, 255, 255, 0.05);
		transition:
			transform 0.2s ease,
			box-shadow 0.2s ease;
	}

	.preview-item:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 16px rgba(0, 0, 0, 0.25);
		border-color: rgba(255, 255, 255, 0.15);
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

	.slide-down-enter-active,
	.slide-down-leave-active {
		transition: all 0.2s ease;
		max-height: 100px;
		overflow: hidden;
	}

	.slide-down-enter-from,
	.slide-down-leave-to {
		max-height: 0;
		opacity: 0;
		padding-top: 0;
		padding-bottom: 0;
		border-bottom-width: 0;
	}

	.input-row {
		display: flex;
		align-items: flex-end;
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
		transition: all 0.2s ease;
		padding: 0;
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		border-radius: 8px;
	}

	.icon-btn:hover:not(:disabled) {
		color: var(--text);
		background-color: rgba(255, 255, 255, 0.08);
	}

	.icon-btn:active:not(:disabled) {
		transform: scale(0.92);
	}

	.icon-btn.send.active {
		color: var(--text);
		cursor: pointer;
	}

	.icon-btn.send:disabled {
		color: #555;
	}


	.input-row > textarea {
		flex: 1;
		border: none;
		background: transparent;
		color: white;
		font-size: 1rem;
		font-family: inherit;
		line-height: 1.4;
		outline: none;
		padding: 7px 8px;
		margin: 0;
		min-width: 0;
		min-height: 36px;
		max-height: 240px;
		resize: none;
		overflow-y: auto;
		word-break: break-word;
		box-sizing: border-box;
	}

	.input-row > textarea::placeholder {
		color: var(--text-subtle);
		opacity: 0.6;
	}

	.input-row > textarea::-webkit-scrollbar {
		width: 4px;
	}

	.input-row > textarea::-webkit-scrollbar-thumb {
		background: #444;
		border-radius: 4px;
	}

	.input-row > textarea::-webkit-scrollbar-track {
		background: transparent;
	}
</style>
