<script setup lang="ts">
	import { computed, watch, ref, onMounted, nextTick } from 'vue';
	import Message from './Message.vue';
	import type { Message as MessageType, User, id } from '@/types';
	import { useUserStore } from '@/stores/user';

	const props = defineProps<{
		messages: MessageType[];
	}>();

	const userStore = useUserStore();

	const scroller = ref<HTMLElement | null>(null);

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
		<Message
			v-for="(message, index) in props.messages"
			:key="message.id.toString()"
			:message="message"
			:user="index === 0 || messages[index - 1].from !== message.from ? userStore.users.get(message.from) : undefined"
		/>
	</div>
</template>

<style scoped>
	.message-list {
		height: 100%;
		overflow-y: auto;
		position: relative;
		scrollbar-width: none;
		padding-bottom: 100px;
	}

	.message-list::-webkit-scrollbar {
		display: none;
	}
</style>
