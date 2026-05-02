<script setup lang="ts">
	import { storeToRefs } from 'pinia';
	import { Icon } from '@iconify/vue';
	import { useErrorStore } from '@/stores/error';

	const errorStore = useErrorStore();
	const { errors } = storeToRefs(errorStore);
</script>

<template>
	<div class="error-toast-container">
		<TransitionGroup name="error-toast" tag="div" class="error-toast-list">
			<div v-for="err in errors" :key="err.id" class="error-toast" @click="errorStore.dismiss(err.id)">
				<Icon icon="mdi:alert-circle" class="icon" />
				<span class="message">{{ err.message }}</span>
				<Icon icon="mdi:close" class="close" />
			</div>
		</TransitionGroup>
	</div>
</template>

<style scoped>
	.error-toast-container {
		position: fixed;
		top: 40px;
		right: 16px;
		z-index: 10000;
		pointer-events: none;
	}

	.error-toast-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
		align-items: flex-end;
	}

	.error-toast {
		pointer-events: auto;
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 280px;
		max-width: 380px;
		padding: 0.7rem 0.85rem 0.7rem 0.75rem;
		background: var(--bg-darker);
		color: var(--text);
		border: 1px solid var(--border);
		border-left: 3px solid var(--error);
		border-radius: 4px;
		box-shadow:
			0 8px 24px -6px rgba(0, 0, 0, 0.45),
			0 2px 6px -1px rgba(0, 0, 0, 0.3);
		font-weight: 500;
		font-size: 1rem;
		letter-spacing: 0.01em;
		cursor: pointer;
		transition: border-color 0.15s ease;
	}

	.error-toast:hover {
		border-color: var(--bg-lighter);
		border-left-color: var(--error);
	}

	.icon {
		font-size: 20px;
		flex-shrink: 0;
		color: var(--error);
	}

	.message {
		flex: 1;
		word-break: break-word;
		line-height: 1.4;
		color: var(--text);
		-webkit-user-select: text;
		user-select: text;
	}

	.close {
		font-size: 16px;
		color: var(--text-subtle);
		opacity: 0.7;
		flex-shrink: 0;
		transition:
			opacity 0.15s ease,
			color 0.15s ease;
	}

	.error-toast:hover .close {
		opacity: 1;
		color: var(--text);
	}

	.error-toast-enter-active,
	.error-toast-leave-active {
		transition:
			transform 0.35s cubic-bezier(0.21, 1.02, 0.73, 1),
			opacity 0.3s ease;
	}

	.error-toast-enter-from {
		transform: translateX(120%);
		opacity: 0;
	}

	.error-toast-leave-to {
		transform: translateX(120%);
		opacity: 0;
	}

	.error-toast-leave-active {
		position: absolute;
		right: 0;
	}

	.error-toast-move {
		transition: transform 0.3s ease;
	}
</style>
