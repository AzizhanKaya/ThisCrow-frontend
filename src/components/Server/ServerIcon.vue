<script setup lang="ts">
	import type { PropType } from 'vue';
	import type { Server } from '@/types';
	import { useRoute, useRouter } from 'vue-router';

	const props = defineProps({
		server: {
			type: Object as PropType<Server>,
			required: true,
		},
	});

	const router = useRouter();
	const route = useRoute();

	const onClick = () => {
		router.push({ name: 'server', params: { serverId: props.server.id.toString() } });
	};
</script>

<template>
	<div class="server" @click="onClick" :class="{ 'is-active': route.params.serverId === server.id.toString() }">
		<div class="server-indicator"></div>
		<div class="server-image">
			<img :src="server.icon || '/default-server-icon.png'" />
		</div>
	</div>
</template>

<style scoped>
	.server {
		aspect-ratio: 1;
		width: 100%;
		padding: 2px;
		cursor: pointer;
		position: relative;
	}

	.server-indicator {
		position: absolute;
		background-color: white;
		top: 50%;
		left: -20px;
		transform: translateY(-50%);
		width: 8px;
		height: 0;
		border-radius: 0 4px 4px 0;
		transition: height 0.3s ease;
		pointer-events: none;
		z-index: 1;
		transition:
			height 0.3s ease,
			left 0.3s ease;
	}
	.server.has-unread .server-indicator {
		height: 8px;
	}

	.server:hover .server-indicator {
		height: 15px;
		left: -15px;
	}

	.server.is-active .server-indicator {
		height: 20px;
		left: -15px;
	}

	.server-image {
		width: 100%;
		height: 100%;
		background-color: var(--bg-darker, #36393f);
		overflow: hidden;
		border-radius: 50%;

		transition:
			border-radius 0.3s ease,
			background-color 0.3s ease;
	}

	.server:hover .server-image,
	.server.is-active .server-image {
		border-radius: 16px;
	}

	.server-image > img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
</style>
