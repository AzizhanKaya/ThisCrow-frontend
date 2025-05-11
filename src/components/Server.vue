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
		aspect-ratio: 1;
		border-radius: 10px;
		width: 100%;
		overflow: hidden;
		cursor: grab;
	}

	.server > img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
</style>
