<script lang="ts">
	import type { PropType } from 'vue';
	import type { Server } from '../types';

	export default {
		props: {
			server: {
				type: Object as PropType<Server>,
				required: true,
			},
		},
	};
</script>

<template>
	<div class="server">
		<img :src="server.icon || '/default-server-icon.jpeg'" />
	</div>
</template>

<style scoped>
	.server {
		position: relative;
		aspect-ratio: 1;
		border-radius: 15px;
		width: 100%;
		overflow: hidden;
		cursor: pointer;
	}

	.server::after {
		content: '';
		position: absolute;
		inset: 0;
		background: white;
		opacity: 0;
		transition: opacity 0.1s;
		pointer-events: none;
	}

	.server:hover::after {
		opacity: 0.2;
	}

	.server > img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
</style>
