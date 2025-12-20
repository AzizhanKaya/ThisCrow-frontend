<script setup lang="ts">
	import { Icon } from '@iconify/vue';
	import { useRouter } from 'vue-router';

	interface Props {
		icon: string;
		name: string;
		route: string;
	}

	const props = defineProps<Props>();
	const router = useRouter();

	const goToRoute = () => {
		router.push(props.route);
	};
</script>

<template>
	<div class="button" @click="goToRoute">
		<Icon :icon="props.icon" class="icon" />
		<span>{{ props.name }}</span>
	</div>
</template>

<style scoped>
	.button {
		margin-inline: auto;
		width: 90%;
		background-color: var(--bg2);
		border-radius: 10px;
		height: 40px;
		display: flex;
		padding-left: 15px;
		align-items: center;
		justify-content: flex-start;
		gap: 15px;
		cursor: pointer;
		transition: background-color 0.3s;
		color: var(--text);
	}

	.button:hover {
		background-color: var(--color-dark);
	}

	.icon {
		height: 20px;
		width: 20px;
	}
</style>
