<script setup lang="ts">
	import { computed, watch, ref, nextTick } from 'vue';
	import Message from '@/components/Message/Message.vue';
	import type { Message as MessageType, id } from '@/types';
	import { useUserStore } from '@/stores/user';
	import { useMeStore } from '@/stores/me';
	import { useMessageStore, chatKey, type ChatTarget } from '@/stores/message';
	import { Icon } from '@iconify/vue';
	import { overwriteMessage, deleteMessage } from '@/api/message';
	import ContextMenu from '@/components/ContextMenu.vue';
	import { useKeyStore } from '@/stores/key';
	import { encrypt_message, generate_nonce } from '@/../pkg/wasm_lib';
	import { encode } from '@msgpack/msgpack';

	const props = defineProps<{
		to: id;
		group_id?: id;
	}>();

	const messageStore = useMessageStore();
	const userStore = useUserStore();
	const keyStore = useKeyStore();
	const meStore = useMeStore();
	const me = $computed(() => meStore.me!);

	const chatTarget = computed<ChatTarget>(() =>
		props.group_id ? { kind: 'channel', channel_id: props.to, group_id: props.group_id } : { kind: 'user', user_id: props.to }
	);

	const privateKey = ref<Uint8Array | undefined>(undefined);

	const messages = computed(() => messageStore.getMessages(chatTarget.value).toSorted((a, b) => Number(a.id - b.id)));

	const scroller = ref<HTMLElement | null>(null);
	const isLoadingMore = ref(false);
	const canLoadMore = computed(() => messageStore.hasMore.get(chatKey(chatTarget.value)) !== false);
	const hoveredMessageId = ref<MessageType['id'] | null>(null);

	const contextMenuInfo = ref({
		show: false,
		x: 0,
		y: 0,
		options: [] as { action: string; label: string; icon: string; danger?: boolean; divider?: boolean }[],
		message: null as MessageType | null,
	});

	const handleContextMenu = (e: MouseEvent, message: MessageType) => {
		const options: { action: string; label: string; icon: string; danger?: boolean; divider?: boolean }[] = [
			{ action: 'reply', label: 'Reply', icon: 'mdi:reply' },
		];

		if (me.id === message.from) {
			options.push(
				{ action: 'edit', label: 'Edit', icon: 'mdi:pencil' },
				{ action: 'delete', label: 'Delete', icon: 'mdi:delete', danger: true }
			);
		}

		contextMenuInfo.value = {
			show: true,
			x: e.clientX,
			y: e.clientY,
			options,
			message: message,
		};
	};

	const handleContextSelect = async (action: string) => {
		const msg = contextMenuInfo.value.message;
		if (!msg) return;

		switch (action) {
			case 'reply':
				handleReply(msg);
				break;
			case 'edit':
				await handleOverwrite(msg);
				break;
			case 'delete':
				await handleDelete(msg);
				break;
		}
	};

	const handleReply = (message: MessageType) => {};

	const handleOverwrite = async (message: MessageType) => {
		const newText = prompt('Edit message');
		if (newText !== null) {
			if (!props.group_id) {
				const privateKey = await keyStore.get_private_key(props.to);
				const nonce = generate_nonce();
				const cipher = encrypt_message(privateKey, encode(newText), nonce);

				const messageData = {
					nonce,
					cipher,
				};

				await overwriteMessage(message.id, messageData);
			} else {
				await overwriteMessage(message.id, newText);
			}
		}
	};

	const handleDelete = async (message: MessageType) => {
		if (confirm('Are you sure you want to delete this message?')) {
			await deleteMessage(message.id);
		}
	};

	const scrollToBottom = () => {
		return new Promise<void>((resolve) => {
			const el = scroller.value;
			if (!el) {
				resolve();
				return;
			}

			let timeout: ReturnType<typeof setTimeout>;
			const doScroll = () => {
				el.scrollTop = el.scrollHeight;
			};

			const observer = new MutationObserver(() => {
				doScroll();
				clearTimeout(timeout);
				timeout = setTimeout(() => {
					observer.disconnect();
					resolve();
				}, 150);
			});

			observer.observe(el, { childList: true, subtree: true, characterData: true });

			doScroll();
			timeout = setTimeout(() => {
				observer.disconnect();
				resolve();
			}, 150);
		});
	};

	const onScroll = async () => {
		const el = scroller.value;
		if (!el || isLoadingMore.value || !canLoadMore.value) return;

		if (el.scrollTop < 50) {
			isLoadingMore.value = true;

			const oldScrollHeight = el.scrollHeight;
			const oldScrollTop = el.scrollTop;

			await messageStore.loadMore(chatTarget.value);

			await nextTick();
			await nextTick();

			el.scrollTop = el.scrollHeight - oldScrollHeight + oldScrollTop;
			isLoadingMore.value = false;
		}
	};

	watch(
		chatTarget,
		async (newTarget) => {
			if (newTarget.kind === 'user') {
				privateKey.value = await keyStore.get_private_key(newTarget.user_id);
			} else {
				privateKey.value = undefined;
			}

			await messageStore.initChat(newTarget);
			await scrollToBottom();
		},
		{ immediate: true }
	);

	watch(
		() => messages.value.length,
		async (newLen, oldLen) => {
			if (!isLoadingMore.value && newLen > oldLen) {
				await scrollToBottom();
			}
		},
		{ flush: 'post' }
	);
</script>

<template>
	<div ref="scroller" class="message-list" @scroll="onScroll">
		<div class="message-spacer"></div>
		<div v-if="isLoadingMore" class="load-more-spinner">
			<Icon icon="svg-spinners:ring-resize" width="24" height="24" />
		</div>

		<div v-if="messages.length === 0" class="no-messages">
			<div class="no-messages-icon">
				<Icon icon="ri:message-2-fill" width="56" height="56" />
			</div>
			<h3>Burası çok sessiz...</h3>
			<p>İlk mesajı göndererek sohbeti başlatabilirsiniz.</p>
		</div>

		<div
			v-for="(message, index) in messages"
			:key="message.id.toString()"
			class="message-wrapper"
			@mouseenter="hoveredMessageId = message.id"
			@mouseleave="hoveredMessageId = null"
			@contextmenu.prevent="handleContextMenu($event, message)"
		>
			<Message
				:message="message"
				:user="index === 0 || messages[index - 1].from !== message.from ? userStore.users.get(message.from) : undefined"
				:private-key="privateKey"
			/>
			<div v-if="hoveredMessageId === message.id" class="message-actions">
				<Icon icon="mdi:reply" class="action-icon" @click="handleReply(message)" title="Yanıtla" />
				<template v-if="me.id === message.from">
					<Icon icon="mdi:pencil" class="action-icon" @click="handleOverwrite(message)" title="Düzenle" />
					<Icon icon="mdi:delete" class="action-icon action-delete" @click="handleDelete(message)" title="Sil" />
				</template>
			</div>
		</div>

		<ContextMenu
			:show="contextMenuInfo.show"
			:x="contextMenuInfo.x"
			:y="contextMenuInfo.y"
			:options="contextMenuInfo.options"
			@close="contextMenuInfo.show = false"
			@select="handleContextSelect"
			:min-width="180"
		/>
	</div>
</template>

<style scoped>
	.message-list {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow-y: auto;
		position: relative;
		scrollbar-width: none;
		padding-bottom: 90px;
	}

	.message-spacer {
		margin-top: auto;
	}

	.load-more-spinner {
		flex-shrink: 0;
		display: flex;
		justify-content: center;
		padding: 12px 0;
		color: var(--text-muted);
	}

	.message-list::-webkit-scrollbar {
		display: none;
	}

	.message-wrapper {
		flex-shrink: 0;
		position: relative;
	}

	.message-actions {
		position: absolute;
		right: 20px;
		top: -34px;
		display: flex;
		gap: 4px;
		background: var(--bg-dark);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 4px;
		box-shadow: 0 4px 8px var(--overlay);
		z-index: 10;
		align-items: center;
	}

	.action-icon {
		cursor: pointer;
		font-size: 1.5rem;
		color: var(--text-muted);
		padding: 6px;
		border-radius: 6px;
		transition:
			background-color 0.15s ease-in-out,
			color 0.15s ease-in-out,
			transform 0.1s ease-in-out;
	}

	.action-icon:hover {
		background: var(--bg-lighter);
		color: var(--text);
		transform: scale(1.1);
	}

	.message-wrapper:has(.message-actions:hover) {
		background-color: var(--bg-light);
	}

	.action-delete:hover {
		color: var(--error);
		background: var(--bg-light);
	}

	.no-messages {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		text-align: center;
		width: 100%;
		pointer-events: none;
	}

	.no-messages-icon {
		background: linear-gradient(0deg, var(--color-darkest), var(--color-lightest));
		border-radius: 50%;
		padding: 24px;
		margin-bottom: 24px;
		color: var(--text-muted);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
		animation: float-up 3s ease-in-out infinite;
	}

	.no-messages h3 {
		font-size: 1.6rem;
		color: var(--text);
		margin: 0 0 10px 0;
		font-weight: 700;
		letter-spacing: -0.01em;
	}

	.no-messages p {
		font-size: 1rem;
		color: var(--text-muted);
		max-width: 320px;
		margin: 0;
		line-height: 1.6;
	}

	@keyframes float-up {
		0% {
			transform: translateY(0px);
		}
		50% {
			transform: translateY(-8px);
		}
		100% {
			transform: translateY(0px);
		}
	}
</style>
