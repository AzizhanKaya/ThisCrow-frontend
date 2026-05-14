<script setup lang="ts">
	import { computed, watch, ref, nextTick } from 'vue';
	import Message from '@/components/Message/Message.vue';
	import type { Message as MessageType, id, snowflake_id } from '@/types';
	import { useUserStore } from '@/stores/user';
	import { useMeStore } from '@/stores/me';
	import { useMessageStore, chatKey, type ChatTarget } from '@/stores/message';
	import { Icon } from '@iconify/vue';
	import { deleteMessage } from '@/api/message';
	import ContextMenu from '@/components/ContextMenu.vue';
	import { useKeyStore } from '@/stores/key';
	import { useErrorStore } from '@/stores/error';
	import ProfileCard from '@/components/ProfileCard.vue';
	import { ModalView, useModalStore } from '@/stores/modal';
	import { useServerStore } from '@/stores/server';

	const props = defineProps<{
		to: id;
		group_id?: id;
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

	const me = $computed(() => meStore.me!);

	const chatTarget = computed<ChatTarget>(() =>
		props.group_id ? { kind: 'channel', channel_id: props.to, group_id: props.group_id } : { kind: 'user', user_id: props.to }
	);

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

	const contextMenu = ref({
		show: false,
		x: 0,
		y: 0,
		options: [] as { action: string; label: string; icon: string; danger?: boolean; divider?: boolean }[],
		message: null as MessageType | null,
	});

	const profileCard = ref({
		show: false,
		x: 0,
		y: 0,
		user: null as ReturnType<typeof userStore.users.get> | null,
	});

	const handleOpenProfile = (payload: { user: any; x: number; y: number }) => {
		if (profileCard.value.show && profileCard.value.user?.id === payload.user.id) {
			profileCard.value.show = false;
			return;
		}
		profileCard.value = {
			show: true,
			x: payload.x,
			y: payload.y,
			user: payload.user,
		};
	};

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

		contextMenu.value = {
			show: true,
			x: e.clientX,
			y: e.clientY,
			options,
			message: message,
		};
	};

	const handleContextSelect = async (action: string) => {
		const msg = contextMenu.value.message;
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

	const handleReply = (message: MessageType) => {
		emit('reply', message.id);
	};

	const repliedLookup = (id: snowflake_id) => messageStore.findMessage(chatTarget.value, id);

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
		modalStore.openModal(ModalView.EDIT_MESSAGE, {
			message,
			group_id: props.group_id,
			to: props.to,
		});
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

			await messageStore.initChat(newTarget);
			await scrollToBottom();
		},
		{ immediate: true }
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
	<div ref="scroller" class="message-list" @scroll="onScroll">
		<div class="message-spacer"></div>
		<div v-if="isLoadingMore" class="load-more-spinner">
			<Icon icon="svg-spinners:ring-resize" width="24" height="24" />
		</div>

		<div v-if="messages?.length === 0" class="no-messages">
			<div class="no-messages-icon">
				<Icon icon="ri:message-2-fill" width="56" height="56" />
			</div>
			<h3>It's very quiet in here...</h3>
			<p>Start the conversation by sending the first message!</p>
		</div>

		<div
			v-if="messages && privateKey !== undefined"
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
				:repliedLookup="repliedLookup"
				:color="getTopRoleColor(message.from)"
				@open-profile="handleOpenProfile"
				@scroll-to="scrollToMessage"
			/>
			<div v-if="hoveredMessageId === message.id" class="message-actions">
				<div class="action-btn" title="Add Reaction">
					<Icon icon="mdi:emoticon-outline" />
				</div>
				<div class="action-btn" title="Reply" @click="handleReply(message)">
					<Icon icon="mdi:reply" />
				</div>
				<template v-if="me.id === message.from">
					<div class="action-btn" title="Edit" @click="handleOverwrite(message)">
						<Icon icon="mdi:pencil-outline" />
					</div>
					<div class="action-btn action-delete" title="Delete" @click="handleDelete(message)">
						<Icon icon="mdi:trash-can-outline" />
					</div>
				</template>
			</div>
		</div>

		<ContextMenu
			:show="contextMenu.show"
			:x="contextMenu.x"
			:y="contextMenu.y"
			:options="contextMenu.options"
			@close="contextMenu.show = false"
			@select="handleContextSelect"
			:min-width="180"
		/>

		<ProfileCard
			v-if="profileCard.user"
			:user="profileCard.user"
			:show="profileCard.show"
			:x="profileCard.x"
			:y="profileCard.y"
			@close="profileCard.show = false"
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
		padding-bottom: 80px;
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

	.message-wrapper.highlighted {
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
		top: -16px;
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

	.message-wrapper:has(.message-actions:hover) {
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
