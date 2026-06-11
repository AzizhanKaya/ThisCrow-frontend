<script setup lang="ts">
	import { computed, watch, ref, nextTick } from 'vue';
	import Message from '@/components/Message/Message.vue';
	import EmojiPicker from '@/components/EmojiPicker.vue';
	import type { Message as MessageType, id, snowflake_id } from '@/types';
	import { useUserStore } from '@/stores/user';
	import { useMeStore } from '@/stores/me';
	import { useMessageStore, chatKey, type ChatTarget } from '@/stores/message';
	import { Icon } from '@iconify/vue';
	import { deleteMessage, overwriteMessage } from '@/api/message';
	import { useKeyStore } from '@/stores/key';
	import { useErrorStore } from '@/stores/error';
	import { ModalView, useModalStore } from '@/stores/modal';
	import { useServerStore } from '@/stores/server';
	import { useContextMenuStore } from '@/stores/contextMenu';
	import type { ContextMenuOption } from '@/components/ContextMenu.vue';
	import { can } from '@/utils/perms';
	import { generate_nonce, encrypt_message, decrypt_message } from '../../../pkg/wasm_lib';
	import { encode, decode } from '@/utils/msgpack';

	const props = defineProps<{
		to: id;
		group_id?: id;
		isReplying?: boolean;
	}>();

	const emit = defineEmits<{
		(e: 'reply', id: snowflake_id): void;
	}>();

	const messageStore = useMessageStore();
	const userStore = useUserStore();
	const keyStore = useKeyStore();
	const errorStore = useErrorStore();
	const meStore = useMeStore();
	const modalStore = useModalStore();
	const serverStore = useServerStore();
	const contextMenuStore = useContextMenuStore();

	const me = $computed(() => meStore.me!);

	const chatTarget = computed<ChatTarget>(() =>
		props.group_id ? { kind: 'channel', channel_id: props.to, group_id: props.group_id } : { kind: 'user', user_id: props.to }
	);

	const server = computed(() => (props.group_id ? serverStore.getServerById(props.group_id) : undefined));
	const channel = computed(() => (props.group_id ? server.value?.channels?.get(props.to) : undefined));
	const p = can(server, channel);
	const canRead = computed(() => !props.group_id || p.viewMessages);
	const canReadHistory = computed(() => !props.group_id || p.readMessageHistory);
	const canManage = computed(() => !!props.group_id && p.manageMessages);

	const privateKey = ref<Uint8Array | null | undefined>(undefined);

	const messages = computed(() => messageStore.getMessages(chatTarget.value));

	function getTopRoleColor(userId: id): string | undefined {
		if (!props.group_id) return undefined;
		const server = serverStore.servers.get(props.group_id);
		if (!server) return undefined;
		const member = server.members?.get(userId);
		if (!member || !member.roles || member.roles.length === 0) return undefined;
		return member.roles.reduce((top, r) => (r.position > top.position ? r : top)).color || undefined;
	}

	const scroller = ref<HTMLElement | null>(null);
	const isLoadingMore = ref(false);
	const isNavigatingToMessage = ref(false);
	const canLoadMore = computed(() => messageStore.hasMore.get(chatKey(chatTarget.value)) !== false);
	const hoveredMessageId = ref<MessageType['id'] | null>(null);
	const editingMessageId = ref<snowflake_id | null>(null);
	const editText = ref('');
	const editOriginalData = ref<any>(null);
	const isSavingEdit = ref(false);

	function isCallData(data: any): boolean {
		return data && typeof data === 'object' && 'end_time' in data;
	}

	const handleContextMenu = async (e: MouseEvent, message: MessageType) => {
		reactionPickerAnchor.value = null;
		reactionTargetId.value = null;

		const options: ContextMenuOption[] = [{ action: 'reply', label: 'Reply', icon: 'mdi:reply' }];

		options.push({ action: 'react', label: 'Add Reaction', icon: 'mdi:emoticon-outline' });

		if (me.id === message.from && !isCallData(message.data)) {
			options.push(
				{ action: 'edit', label: 'Edit', icon: 'mdi:pencil-outline' },
				{ action: 'delete', label: 'Delete', icon: 'mdi:trash-can-outline', variant: 'danger' }
			);
		} else if (canManage.value) {
			options.push({ action: 'delete', label: 'Delete', icon: 'mdi:trash-can-outline', variant: 'danger' });
		}

		contextMenuStore.open({
			e,
			options,
			minWidth: 180,
			onSelect: (action) => handleContextSelect(action, message),
		});
	};

	const handleContextSelect = async (action: string, msg: MessageType) => {
		switch (action) {
			case 'react':
				openReactionPicker(msg.id);
				break;
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

	const handleReply = (message: MessageType) => {
		emit('reply', message.id);
	};

	const highlightedId = ref<snowflake_id | null>(null);
	let highlightTimer: ReturnType<typeof setTimeout> | null = null;

	async function scrollToMessage(id: snowflake_id) {
		const msg = await messageStore.findMessage(chatTarget.value, id);
		if (!msg) {
			errorStore.pushFrom(new Error('Original message unavailable'), 'Original message unavailable');
			return;
		}

		isNavigatingToMessage.value = true;

		try {
			await messageStore.loadMessagesUntil(chatTarget.value, id);
		} catch (e: any) {
			isNavigatingToMessage.value = false;
			errorStore.pushFrom(e instanceof Error ? e : new Error(String(e)), 'Failed to load messages');
			return;
		}

		await nextTick();
		await nextTick();

		const el = scroller.value?.querySelector(`[data-message-id="${id.toString()}"]`) as HTMLElement | null;
		if (!el) {
			isNavigatingToMessage.value = false;
			return;
		}

		el.scrollIntoView({ behavior: 'smooth', block: 'center' });
		highlightedId.value = id;
		if (highlightTimer) clearTimeout(highlightTimer);
		highlightTimer = setTimeout(() => {
			highlightedId.value = null;
			highlightTimer = null;
		}, 1500);

		setTimeout(() => {
			isNavigatingToMessage.value = false;
		}, 1000);
	}

	const handleOverwrite = async (message: MessageType) => {
		let data = message.data;

		if (isCallData(data)) return;

		if (data && typeof data === 'object' && 'cipher' in data && !props.group_id) {
			try {
				const pk = await keyStore.get_private_key(props.to);
				const decrypted = decrypt_message(pk, (data as any).cipher, (data as any).nonce);
				data = decode(decrypted) as any;
			} catch (e) {
				console.error('Failed to decrypt message for editing:', e);
				return;
			}
		}

		editOriginalData.value = data;

		if (typeof data === 'string') {
			editText.value = data;
		} else if (data && typeof data === 'object') {
			if ('replied' in data && 'data' in data) {
				editText.value = (data as any).data.text || '';
			} else if ('text' in data) {
				editText.value = (data as any).text || '';
			}
		}
		editingMessageId.value = message.id;
	};

	const cancelEdit = () => {
		editingMessageId.value = null;
		editText.value = '';
		editOriginalData.value = null;
		isSavingEdit.value = false;
	};

	const saveEdit = async () => {
		const msgId = editingMessageId.value;
		if (!msgId || !editText.value.trim()) return;
		isSavingEdit.value = true;
		try {
			const orig = editOriginalData.value;
			let newData: any;

			if (typeof orig === 'string') {
				newData = editText.value;
			} else if (orig && typeof orig === 'object' && 'replied' in orig && 'data' in orig) {
				newData = { ...orig, data: { ...orig.data, text: editText.value } };
			} else if (orig && typeof orig === 'object') {
				newData = { ...orig, text: editText.value };
			} else {
				newData = editText.value;
			}

			if (!props.group_id) {
				const pk = await keyStore.get_private_key(props.to);
				const nonce = generate_nonce();
				const cipher = encrypt_message(pk, encode(newData), nonce);
				await overwriteMessage(msgId, { nonce, cipher } as any);
			} else {
				await overwriteMessage(msgId, newData as any);
			}
			cancelEdit();
		} catch (e) {
			console.error(e);
			errorStore.pushFrom(e, 'Failed to edit message.');
		} finally {
			isSavingEdit.value = false;
		}
	};

	const handleDelete = async (message: MessageType) => {
		modalStore.openModal(ModalView.CONFIRM, {
			icon: 'mdi:trash-can-outline',
			title: 'Delete Message',
			text: 'Are you sure you want to delete this message? This action cannot be undone.',
			command: async () => {
				await deleteMessage(message.id);
			},
		});
	};

	const reactionPickerAnchor = ref<HTMLElement | null>(null);
	const reactionTargetId = ref<snowflake_id | null>(null);

	function openReactionPicker(messageId: snowflake_id, e?: MouseEvent) {
		if (e) {
			reactionPickerAnchor.value = e.currentTarget as HTMLElement;
		} else {
			const el = scroller.value?.querySelector(`[data-message-id="${messageId.toString()}"]`) as HTMLElement | null;
			reactionPickerAnchor.value = el;
		}
		reactionTargetId.value = messageId;
	}

	function onReactionSelect(emoji: string) {
		const id = reactionTargetId.value;
		if (!id) return;
		messageStore.toggleReaction(chatTarget.value, id, emoji);
		reactionTargetId.value = null;
		reactionPickerAnchor.value = null;
	}

	function toggleReaction(emoji: string, messageId: snowflake_id) {
		messageStore.toggleReaction(chatTarget.value, messageId, emoji);
	}

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
		if (!el || isLoadingMore.value || !canLoadMore.value || isNavigatingToMessage.value) return;
		if (!canReadHistory.value) return;

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
			privateKey.value = undefined;

			if (newTarget.kind === 'user') {
				privateKey.value = await keyStore.get_private_key(newTarget.user_id);
			} else {
				privateKey.value = null;
			}

			if (!canRead.value) return;

			await messageStore.initChat(newTarget);
			await scrollToBottom();
		},
		{ immediate: true }
	);

	const isAtBottom = () => {
		const el = scroller.value;
		if (!el) return false;
		return el.scrollHeight - el.scrollTop - el.clientHeight < 50;
	};

	watch(
		() => props.isReplying,
		async (replying) => {
			if (!replying) {
				return;
			}

			if (!isAtBottom()) return;

			await nextTick();

			const el = scroller.value;
			if (!el) return;
			const start = performance.now();
			const animate = () => {
				el.scrollTop = el.scrollHeight;
				if (performance.now() - start < 250) requestAnimationFrame(animate);
			};
			requestAnimationFrame(animate);
		}
	);

	watch(
		() => messages.value?.length,
		async (newLen, oldLen) => {
			if (!newLen || !oldLen) return;
			if (!isLoadingMore.value && !isNavigatingToMessage.value && newLen > oldLen) {
				await scrollToBottom();
			}
		},
		{ flush: 'post' }
	);
</script>

<template>
	<div ref="scroller" class="message-list" :class="{ 'is-replying': isReplying }" @scroll="onScroll">
		<div class="message-spacer"></div>
		<div v-if="isLoadingMore" class="load-more-spinner">
			<Icon icon="svg-spinners:ring-resize" width="24" height="24" />
		</div>

		<div v-if="!canRead" class="no-messages">
			<div class="no-messages-icon">
				<Icon icon="mdi:eye-off-outline" width="56" height="56" />
			</div>
			<h3>No access</h3>
			<p>You don't have permission to view messages in this channel.</p>
		</div>
		<div v-else-if="messages?.length === 0" class="no-messages">
			<div class="no-messages-icon">
				<Icon icon="ri:message-2-fill" width="56" height="56" />
			</div>
			<h3>It's very quiet in here...</h3>
			<p>Start the conversation by sending the first message!</p>
		</div>

		<div
			v-if="canRead && messages && privateKey !== undefined"
			v-for="(message, index) in messages"
			:key="message.id.toString()"
			:data-message-id="message.id.toString()"
			class="message-wrapper"
			:class="{ highlighted: highlightedId === message.id }"
			@mouseenter="hoveredMessageId = message.id"
			@mouseleave="hoveredMessageId = null"
			@contextmenu.prevent="handleContextMenu($event, message)"
		>
			<Message
				:message="message"
				:user="index === 0 || messages[index - 1].from !== message.from ? userStore.users.get(message.from) : undefined"
				:privateKey="privateKey"
				:color="getTopRoleColor(message.from)"
				:editing="editingMessageId === message.id"
				:editText="editingMessageId === message.id ? editText : ''"
				:isSavingEdit="isSavingEdit"
				@scroll-to="scrollToMessage"
				@toggle-reaction="toggleReaction($event, message.id)"
				@update:editText="editText = $event"
				@save-edit="saveEdit"
				@cancel-edit="cancelEdit"
			/>
			<div v-if="hoveredMessageId === message.id && editingMessageId !== message.id" class="message-actions">
				<div class="action-btn" title="Add Reaction" @click="openReactionPicker(message.id, $event)">
					<Icon icon="mdi:emoticon-outline" />
				</div>
				<div class="action-btn" title="Reply" @click="handleReply(message)">
					<Icon icon="mdi:reply" />
				</div>
				<template v-if="me.id === message.from">
					<div v-if="!isCallData(message.data)" class="action-btn" title="Edit" @click="handleOverwrite(message)">
						<Icon icon="mdi:pencil-outline" />
					</div>
					<div class="action-btn action-delete" title="Delete" @click="handleDelete(message)">
						<Icon icon="mdi:trash-can-outline" />
					</div>
				</template>
			</div>
		</div>
	</div>

	<EmojiPicker
		v-if="reactionPickerAnchor"
		:anchor="reactionPickerAnchor"
		@select="onReactionSelect"
		@close="
			reactionPickerAnchor = null;
			reactionTargetId = null;
		"
	/>
</template>

<style scoped>
	.message-list {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow-y: auto;
		position: relative;
		scrollbar-width: none;
		padding-bottom: 80px;
		transition: padding-bottom 0.2s ease;
	}

	.message-list.is-replying {
		padding-bottom: 124px;
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

	.history-banner {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 12px 16px;
		margin: 8px 16px;
		border-radius: 6px;
		background-color: var(--bg-dark);
		color: var(--text-muted);
		font-size: 0.85rem;
	}

	.message-list::-webkit-scrollbar {
		display: none;
	}

	.message-wrapper {
		flex-shrink: 0;
		position: relative;
	}

	.message-wrapper.highlighted :deep(.message) {
		animation: reply-highlight 1.5s ease-out;
	}

	@keyframes reply-highlight {
		0% {
			background-color: hsla(261, 68%, 50%, 0.32);
		}
		60% {
			background-color: hsla(261, 68%, 50%, 0.32);
		}
		100% {
			background-color: transparent;
		}
	}

	.message-actions {
		position: absolute;
		right: 16px;
		bottom: 100%;
		transform: translateY(4px);
		display: flex;
		align-items: center;
		gap: 2px;
		background: var(--bg-dark, #2b2d31);
		border: 1px solid var(--border-muted, rgba(0, 0, 0, 0.2));
		border-radius: 8px;
		padding: 2px 4px;
		box-shadow:
			0 0 0 1px var(--bg, #313338),
			0 2px 6px rgba(0, 0, 0, 0.15);
		z-index: 10;
		height: 32px;
	}

	.action-btn {
		cursor: pointer;
		color: var(--text-muted);
		padding: 4px 6px;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition:
			background-color 0.1s ease,
			color 0.1s ease;
	}

	.action-btn svg {
		font-size: 1.15rem;
	}

	.action-btn:hover {
		background-color: var(--bg-lighter, rgba(255, 255, 255, 0.08));
		color: var(--text);
	}

	.message-wrapper:has(.message-actions:hover) :deep(.message) {
		background-color: var(--bg-light);
	}

	.action-delete {
		color: var(--danger, #f23f42);
	}

	.action-delete:hover {
		background-color: rgba(242, 63, 66, 0.1);
		color: var(--danger, #f23f42);
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
		background: var(--bg-dark);
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
