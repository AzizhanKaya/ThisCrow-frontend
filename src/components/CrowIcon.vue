<script setup lang="ts">
	import { useRouter } from 'vue-router';

	const router = useRouter();
</script>

<template>
	<div @click="router.push({ name: 'chats' })" class="crow-icon">
		<img src="/crow.png" />
	</div>
</template>

<style scoped>
	.crow-icon {
		position: relative;
		aspect-ratio: 1;
		border-radius: 15px;
		width: 100%;
		overflow: hidden;
		cursor: pointer;
		border: 2px #444444 solid;
		box-sizing: border-box;
	}

	.crow-icon::after {
		content: '';
		position: absolute;
		inset: 0;
		background: white;
		opacity: 0;
		transition: opacity 0.1s;
		pointer-events: none;
	}

	.crow-icon:hover::after {
		opacity: 0.2;
	}

	.crow-icon > img {
		width: 80%;
		aspect-ratio: 1;
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		object-fit: contain;
	}
</style>
