<script lang="ts">
	import type { PropType } from 'vue';
	import { type User, Status } from '@/types';

	export default {
		props: {
			user: {
				type: Object as PropType<User>,
				required: true,
			},
		},
		computed: {
			getStatus(): string {
				switch (this.user.status) {
					case Status.Online:
						return 'online';
					case Status.Idle:
						return 'idle';
					case Status.Dnd:
						return 'dnd';
					case Status.Offline:
						return 'offline';
				}
			},
		},
	};
</script>

<template>
	<div class="user">
		<img class="avatar" :src="user.avatar || '/default-user-icon.png'" />

		<span class="name">{{ user.name }}</span>
		<span class="username">@{{ user.username }}</span>
		<div class="status" :class="getStatus"></div>
	</div>
</template>

<style scoped>
	.user {
		height: 50px;
		border-radius: 10px;
		position: relative;
		height: 50px;
	}

	.user:hover {
		background-color: #333;
		cursor: pointer;
	}

	.avatar {
		aspect-ratio: 1;
		height: 100%;
		border-radius: 50%;
		padding: 5px;
		margin-left: 5px;
	}

	.name {
		font-weight: bold;
		font-size: 1.1em;
		color: #dbdbdb;
		position: absolute;
		top: 8px;
		left: 60px;
	}

	.username {
		font-size: 0.9em;
		color: #bebebe;
		position: absolute;
		top: 28px;
		left: 60px;
	}

	.status {
		height: 12px;
		width: 12px;
		border-radius: 50%;
		position: absolute;
		z-index: 10;
		border: 2px #333 solid;
		left: 40px;
		bottom: 5px;
	}

	.online {
		background-color: #43b581;
	}
	.dnd {
		background-color: #f04747;
	}
	.idle {
		background-color: #e2e446;
	}
	.offline {
		background-color: #72767d;
	}
</style>
