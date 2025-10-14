<script setup lang="ts">
	import { ref, onMounted, onUnmounted, computed } from 'vue';
	import { Icon } from '@iconify/vue';
	import MessageBlock from '@/components/MessageBlock.vue';
	import type { User } from '@/types';
	import { type Message, MessageType, computeId } from '@/types';
	import { useFiles } from '@/composables/useFiles';
	import { useScroll } from '@/composables/useScroll';
	import { webrtcService, type Channel } from '@/services/webrtc';
	import { websocketService } from '@/services/websocket';
	import { useUserStore } from '@/stores/user';
	import { useRoute } from 'vue-router';
	import { useFriendStore } from '@/stores/friends';
	import { messageService } from '@/services/message';

	const friendStore = useFriendStore();
	const friends = friendStore.friends;

	const route = useRoute();
	const userStore = useUserStore();

	let user_state = userStore.user!;

	const userId = route.params.userId as string | undefined;
	const user = friends.find((u) => u.id === userId)!;

	const input = ref('');

	const messageBlocks = messageService.messageBlocks;

	const { fileInput, selectedFiles, hasSelectedFiles, handleFileSelect: onFileSelect, removeFile, clearFiles } = useFiles();

	const {
		scrollRef,
		isLoading: loadingOldMessages,
		updateScrollPadding,
		handleScroll,
	} = useScroll(async () => {
		await loadOldMessages();
	});

	onMounted(() => {
		messageService.loadMessages(user);
	});

	async function onSend() {
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

		let message: Message = {
			from: user_state.id,
			to: user.id,
			data: messageData,
			type: MessageType.Direct,
			time: new Date(),
			sent: false,
		};

		message.id = computeId(message);

		messageService.sendMessage(message);

		input.value = '';
		clearFiles();
	}

	function onPlus() {
		fileInput.value?.click();
	}

	function onCall() {
		let channel: Channel = { id: user.id, users: [user.id], name: user.name + '-' + user_state.name };
		webrtcService.joinChannel(channel, 'audio').catch((error) => {
			console.error('Error accessing media devices:', error);
		});
	}

	function onVideo() {
		let channel: Channel = { id: user.id, users: [user.id], name: user.name + '-' + user_state.name };
		webrtcService.joinChannel(channel, 'both').catch((error) => {
			console.error('Error accessing media devices:', error);
		});
	}
</script>

<template>
	<template v-if="user">
		<header>
			<img :src="user.avatar || '/default-user-icon.png'" alt="" />
			<div class="container">
				<span class="name">{{ user.name }}</span>
				<span class="username">@{{ user.username }}</span>
			</div>
			<div class="call-container">
				<div class="call-btn" @click="onCall">
					<Icon icon="fa6-solid:phone" width="20" height="20" />
				</div>
				<div class="video-btn" @click="onVideo">
					<Icon icon="weui:video-call-filled" width="24" height="24" />
				</div>
			</div>
		</header>
		<main ref="scrollRef" @scroll="handleScroll">
			<MessageBlock v-if="messageBlocks.length > 0" v-for="(block, index) in messageBlocks" :key="index" :block="block" />
		</main>
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
					<button class="icon-btn send" :class="{ active: input.length > 0 || hasSelectedFiles }" @click="onSend" :disabled="!input.length && !hasSelectedFiles">
						<Icon icon="mdi:send" width="24" height="24" />
					</button>
				</div>
			</div>
		</div>
	</template>
</template>

<style scoped>
	main {
		height: calc(98vh - 60px);
		overflow-y: auto;
		overflow-x: hidden;
		padding-bottom: 80px;
		margin-top: 55px;
	}

	header {
		background-color: #202225;
		height: 55px;
		width: 100%;
		position: absolute;
		border-top: 1px solid #303030;
		border-bottom: 1px solid #303030;
		z-index: 10;
		display: flex;
		align-items: center;
		padding-left: 10px;
		gap: 5px;
	}

	header img {
		aspect-ratio: 1;
		height: 80%;
		border-radius: 50%;
	}

	header .container {
		display: flex;
		flex-direction: column;
	}

	header .container .name {
		font-weight: bold;
		color: #dbdbdb;
		font-size: 1.3rem;
		cursor: pointer;
	}
	header .container .name:hover {
		text-decoration: underline;
	}
	header .container .username {
		font-size: 0.9rem;
		color: #bebebe;
		cursor: default;
	}

	header .call-container {
		display: flex;
		align-items: center;
		justify-content: center;
		margin-left: auto;
		gap: 10px;
		padding-right: 20px;
	}
	header .call-btn {
		color: #fff;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		transform: rotateY(180deg);
	}

	header .video-btn {
		color: #fff;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: 50%;
	}

	header .call-btn:hover,
	header .video-btn:hover {
		background-color: #303030;
	}

	.messages-list {
		display: flex;
		flex-direction: column;
	}

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
		color: #fff;
	}

	.icon-btn.send.active {
		color: #fff;
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
