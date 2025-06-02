<script setup lang="ts">
	import { ref, onMounted } from 'vue';

	const props = defineProps<{
		message: string;
		duration?: number;
	}>();

	const visible = ref(true);

	onMounted(() => {
		setTimeout(() => {
			visible.value = false;
		}, props.duration || 2000);
	});
</script>

<template>
	<transition name="slide-fade">
		<div v-if="visible" class="toast">{{ message }}</div>
	</transition>
</template>

<style scoped>
	.toast {
		position: fixed;
		top: 20px;
		left: 50%;
		transform: translateX(-50%);
		background: #ff4d4f;
		color: white;
		padding: 1rem 1.5rem;
		border-radius: 8px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
		z-index: 100;
		font-weight: 500;
		transition: all 0.4s ease;
	}

	.slide-fade-enter-from {
		opacity: 0;
		transform: translate(-50%, -20px) scale(0.95);
	}

	.slide-fade-leave-to {
		opacity: 0;
		transform: translate(-50%, -20px);
	}
</style>
