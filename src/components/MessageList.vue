<script setup lang="ts">
	import { computed, watch, ref, onMounted, nextTick } from 'vue';
	import { useMessageStore } from '@/stores/message';
	import Message from './Message.vue';
	import type { User, id } from '@/types';

	const props = defineProps<{
		user: User;
		me: User;
	}>();

	const messageStore = useMessageStore();
	const scroller = ref<HTMLElement | null>(null);

	await messageStore.initChat(props.user.id);

	const messages = computed(() => messageStore.messages.get(props.user.id) || []);

	function getUser(id: id): User {
		return id === props.user.id ? props.user : props.me;
	}

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
		() => messages.value[messages.value.length - 1],
		() => {
			scrollToBottom();
		},
		{ flush: 'post' }
	);
</script>

<template>
	<div ref="scroller" class="message-list">
		<Message
			v-for="(message, index) in messages"
			:key="message.id.toString()"
			:message="message"
			:user="index === 0 || messages[index - 1].from !== message.from ? getUser(message.from) : undefined"
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
