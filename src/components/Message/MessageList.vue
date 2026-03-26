<script setup lang="ts">
	import { computed, watch, ref, onMounted, nextTick } from 'vue';
	import Message from '@/components/Message/Message.vue';
	import type { Message as MessageType, User, id } from '@/types';
	import { useUserStore } from '@/stores/user';
	import { useMeStore } from '@/stores/me';
	import { Icon } from '@iconify/vue';
	import { overwriteMessage, deleteMessage } from '@/api/message';
	import ContextMenu from '@/components/ContextMenu.vue';

	const props = defineProps<{
		messages: MessageType[];
	}>();

	const emit = defineEmits<{
		(e: 'reply', message: MessageType): void;
	}>();

	const userStore = useUserStore();
	const meStore = useMeStore();
	const me = $computed(() => meStore.me!);

	const scroller = ref<HTMLElement | null>(null);

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

	const handleReply = (message: MessageType) => {
		emit('reply', message);
	};

	const handleOverwrite = async (message: MessageType) => {
		const newText = prompt('Edit message:', message.data.text || '');
		if (newText !== null && newText !== message.data.text) {
			const updatedMessage = { ...message, data: { ...message.data, text: newText } };
			await overwriteMessage(updatedMessage);
		}
	};

	const handleDelete = async (message: MessageType) => {
		if (confirm('Are you sure you want to delete this message?')) {
			await deleteMessage(message);
		}
	};

	const scrollToBottom = () => {
		if (!scroller.value) return;

		nextTick(() => {
			scroller.value!.scrollTop = scroller.value!.scrollHeight;
		});
	};

	onMounted(async () => {
		scrollToBottom();
	});

	watch(
		() => props.messages[props.messages.length - 1],
		() => {
			scrollToBottom();
		},
		{ flush: 'post' }
	);
</script>

<template>
	<div ref="scroller" class="message-list">
		<div
			v-for="(message, index) in props.messages"
			:key="message.id.toString()"
			class="message-wrapper"
			@contextmenu.prevent="handleContextMenu($event, message)"
		>
			<Message
				:message="message"
				:user="index === 0 || messages[index - 1].from !== message.from ? userStore.users.get(message.from) : undefined"
			/>
			<div class="message-actions">
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
		height: 100%;
		overflow-y: auto;
		position: relative;
		scrollbar-width: none;
		padding-bottom: var(--message-input-padding);
	}

	.message-list::-webkit-scrollbar {
		display: none;
	}

	.message-wrapper {
		position: relative;
	}

	.message-actions {
		position: absolute;
		right: 20px;
		top: -16px;
		display: none;
		background: var(--bg-dark);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 4px;
		box-shadow: 0 4px 8px var(--overlay);
		z-index: 10;
		align-items: center;
	}

	.message-wrapper:hover .message-actions {
		display: flex;
		gap: 4px;
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

	.action-delete:hover {
		color: var(--error);
		background: var(--bg-light);
	}
</style>
