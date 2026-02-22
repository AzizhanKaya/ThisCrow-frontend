<script setup lang="ts">
	import { ref, onMounted, reactive, type Reactive, watch, computed } from 'vue';
	import { Icon } from '@iconify/vue';
	import { type Message as MessageType, MessageType as MessageEnum, type id } from '@/types';
	import { useFiles } from '@/composables/useFiles';
	import { webrtcService, type Channel } from '@/services/webrtc';
	import { useMeStore } from '@/stores/me';
	import { useRoute } from 'vue-router';
	import { useDMStore } from '@/stores/dm';
	import { useMessageStore } from '@/stores/message';
	import MessageInput from '@/components/MessageInput.vue';

	import ChatSkeleton from '@/components/Skeletons/ChatSkeleton.vue';
	import MessageList from '@/components/MessageList.vue';

	const dmStore = useDMStore();
	const route = useRoute();
	const meStore = useMeStore();
	const messageStore = useMessageStore();

	const to = computed(() => BigInt(route.params.userId as string));

	const showSkeleton = ref(false);
	let skeletonTimer: any = null;

	watch(
		to,
		(newTo) => {
			messageStore.initChat(newTo);
			showSkeleton.value = false;
			if (skeletonTimer) clearTimeout(skeletonTimer);
		},
		{ immediate: true }
	);

	watch(
		() => messageStore.isLoadingChat(to.value),
		(loading) => {
			if (skeletonTimer) clearTimeout(skeletonTimer);
			if (loading) {
				skeletonTimer = setTimeout(() => {
					if (messageStore.isLoadingChat(to.value)) {
						showSkeleton.value = true;
					}
				}, 100);
			} else {
				showSkeleton.value = false;
			}
		},
		{ immediate: true }
	);

	function onCall() {
		let channel: Channel = { id: to.value, users: [to.value], name: to.value.toString() + '-' + meStore.me!.id.toString() };
		webrtcService.joinChannel(channel, 'audio').catch((error) => {
			console.error('Error accessing media devices:', error);
		});
	}

	function onVideo() {
		let channel: Channel = { id: to.value, users: [to.value], name: to.value.toString() + '-' + meStore.me!.id.toString() };
		webrtcService.joinChannel(channel, 'both').catch((error) => {
			console.error('Error accessing media devices:', error);
		});
	}
</script>

<template>
	<div class="chat-view">
		<header>
			<div class="call-container">
				<div class="call-btn" @click="onCall">
					<Icon icon="fa6-solid:phone" width="20" height="20" />
				</div>
				<div class="video-btn" @click="onVideo">
					<Icon icon="weui:video-call-filled" width="24" height="24" />
				</div>
			</div>
		</header>
		<main>
			<Transition name="fade" mode="out-in">
				<ChatSkeleton v-if="showSkeleton" />
				<MessageList v-else :messages="messageStore.getMessages(to)" />
			</Transition>
		</main>
		<MessageInput :to="to" :type="MessageEnum.Direct" />
		<div class="input-cover"></div>
	</div>
</template>

<style scoped>
	.chat-view {
		position: absolute;
		width: 100%;
		height: 100%;
	}

	main {
		height: calc(98vh - 55px);
		overflow: hidden;
		margin-top: 62px;
	}

	header {
		background-color: var(--bg-dark);
		height: 62px;
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
		color: var(--text);
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
		color: var(--text);
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

	.input-cover {
		position: absolute;
		bottom: 0;
		width: 100%;
		height: 30px;
		background-color: var(--bg);
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

	.fade-enter-active,
	.fade-leave-active {
		transition: opacity 0.1s ease-in;
	}
	.fade-enter-from,
	.fade-leave-to {
		opacity: 0;
	}
</style>
