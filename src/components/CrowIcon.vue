<script setup lang="ts">
	import { useRouter } from 'vue-router';

	const router = useRouter();
</script>

<template>
	<div>
		<div @click="router.push('/')" class="crow-icon">
			<img src="/default-server-icon.png" />
		</div>
		<div class="separator"></div>
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

	.separator {
		height: 1px;
		background-color: var(--border);
		margin: 7px 0px;
	}
</style>
