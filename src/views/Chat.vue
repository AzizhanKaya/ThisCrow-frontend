<script setup lang="ts">
	import { ref, onMounted, reactive, type Reactive, watch, computed } from 'vue';
	import { Icon } from '@iconify/vue';
	import { type Message as MessageType, MessageType as MessageEnum, type id, type User } from '@/types';
	import { useMeStore } from '@/stores/me';
	import { useRoute } from 'vue-router';
	import { useDMStore } from '@/stores/dm';
	import { useMessageStore, type ChatTarget } from '@/stores/message';
	import { useUserStore } from '@/stores/user';
	import { useVoiceStore } from '@/stores/voice';
	import DirectVoiceHeader from '@/components/Message/DirectVoiceHeader.vue';
	import MessageInput from '@/components/Message/MessageInput.vue';

	import ChatSkeleton from '@/components/Skeletons/ChatSkeleton.vue';
	import MessageList from '@/components/Message/MessageList.vue';
	import { getDefaultAvatar } from '@/utils/avatar';

	const route = useRoute();
	const messageStore = useMessageStore();

	const to = computed(() => {
		return Number(route.params.userId as string);
	});

	const chatTarget = computed<ChatTarget>(() => ({ kind: 'user', user_id: to.value }));

	const showSkeleton = ref(false);
	let skeletonTimer: any = null;

	watch(
		chatTarget,
		(newTarget) => {
			messageStore.initChat(newTarget);
			showSkeleton.value = false;
			if (skeletonTimer) clearTimeout(skeletonTimer);
		},
		{ immediate: true }
	);

	watch(
		() => messageStore.isLoadingChat(chatTarget.value),
		(loading) => {
			if (skeletonTimer) clearTimeout(skeletonTimer);

			const hasMessages = messageStore.getMessages(chatTarget.value).length > 0;

			if (loading && !hasMessages) {
				skeletonTimer = setTimeout(() => {
					if (messageStore.isLoadingChat(chatTarget.value)) {
						showSkeleton.value = true;
					}
				}, 100);
			} else {
				showSkeleton.value = false;
			}
		},
		{ immediate: true }
	);

	const targetUser = ref<User | undefined>(undefined);
	const userStore = useUserStore();
	const voiceStore = useVoiceStore();
	const meStore = useMeStore();

	watch(
		to,
		async (newTo) => {
			if (newTo) {
				targetUser.value = await userStore.getUser(newTo);
			}
		},
		{ immediate: true }
	);

	const isRinging = computed(() => {
		return voiceStore.on_voice_direct.includes(to.value);
	});

	const isCalling = computed(() => {
		return voiceStore.voice_direct?.id === to.value;
	});

	async function onCall() {
		if (!targetUser.value) return;
		if (isCalling.value) {
			await voiceStore.leaveVoice();
		} else {
			await voiceStore.joinVoice(undefined, undefined, targetUser.value);
		}
	}

	async function onVideo() {
		if (!targetUser.value) return;
		if (isCalling.value) {
			await voiceStore.leaveVoice();
		} else {
			await voiceStore.joinVoice(undefined, undefined, targetUser.value);
			await voiceStore.toggleVideo();
		}
	}
</script>

<template>
	<div class="chat-view">
		<header :class="{ 'is-calling': isCalling || isRinging }">
			<DirectVoiceHeader v-if="(isCalling || isRinging) && targetUser" :target-user="targetUser" />

			<div v-if="!(isCalling || isRinging) && targetUser" class="header-user-info">
				<img :src="targetUser.avatar || getDefaultAvatar(targetUser.username)" alt="Target" />
				<div class="container">
					<span class="name">{{ targetUser.name }}</span>
					<span class="username">@{{ targetUser.username }}</span>
				</div>
			</div>

			<div class="call-container" v-if="!(isCalling || isRinging)">
				<div class="call-btn" @click="onCall">
					<Icon icon="fa6-solid:phone" width="20" height="20" />
				</div>
				<div class="video-btn" @click="onVideo">
					<Icon icon="weui:video-call-filled" width="24" height="24" />
				</div>
			</div>
		</header>
		<main>
			<MessageList :to="to" />
			<ChatSkeleton v-if="showSkeleton" class="skeleton-overlay" />
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
		display: flex;
		flex-direction: column;
		--header-height: 50px;
		--message-input-padding: 100px;
	}

	header {
		background-color: var(--bg-dark);
		height: var(--header-height);
		width: 100%;
		border-bottom: 1px solid var(--border);
		display: flex;
		align-items: center;
		padding-left: 10px;
		gap: 5px;
		transition:
			height 0.3s ease,
			background-color 0.3s ease,
			flex-direction 0.3s ease;
	}

	main {
		position: relative;
		flex: 1;
		overflow: hidden;
	}

	.skeleton-overlay {
		position: absolute;
		inset: 0;
		z-index: 2;
		background-color: var(--bg);
	}

	header.is-calling {
		height: auto;
		min-height: 250px;
		flex-direction: column;
		justify-content: center;
		padding-top: 20px;
		padding-bottom: 20px;
		background-color: var(--bg-darker);
	}

	.header-user-info {
		display: flex;
		align-items: center;
		gap: 15px;
		height: 100%;
	}

	header:not(.is-calling) img {
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

	header.is-calling .call-container {
		margin-left: 0;
		padding-right: 0;
		margin-top: auto;
		padding-bottom: 20px;
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
		transition: background-color 0.2s;
	}

	header .call-btn.end-call {
		background-color: #f04747;
		color: white;
		transform: none;
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

	.voice-controls {
		height: 80px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 16px;
		padding: 0 24px;
	}

	.control-btn {
		width: 52px;
		height: 52px;
		border-radius: 50%;
		background-color: var(--bg);
		color: var(--text-muted);
		border: none;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 24px;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.control-btn:hover {
		background-color: var(--bg-light);
		color: var(--text);
	}

	.control-btn.is-active,
	.control-btn.is-danger-active {
		background-color: var(--text);
		color: var(--bg-darkest);
	}

	.control-btn.is-danger-active {
		color: var(--error);
	}

	.control-btn.is-danger-active:hover {
		background-color: var(--text-muted);
	}

	.danger-btn {
		background-color: var(--error);
		color: var(--text);
	}

	.danger-btn:hover {
		background-color: var(--error-hover);
		color: var(--text);
	}

	.disconnect-btn {
		width: 64px;
		border-radius: 24px;
	}
</style>
