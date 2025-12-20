<script lang="ts">
	import type { PropType } from 'vue';
	import { type User, State } from '@/types';

	export default {
		props: {
			user: {
				type: Object as PropType<User>,
				required: true,
			},
		},
		computed: {
			getState(): string {
				switch (this.user.state) {
					case State.Online:
						return 'online';
					case State.Offline:
						return 'offline';
					case State.Dnd:
						return 'dnd';
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
		<div class="state" :class="getState"></div>
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

	.state {
		height: 12px;
		aspect-ratio: 1;
		border-radius: 50%;
		position: absolute;
		z-index: 10;
		border: 2px #333 solid;
		left: 40px;
		bottom: 5px;
		flex-shrink: 0;
	}

	.online {
		background-color: #43b581;
	}
	.dnd {
		background-color: red;
	}

	.offline {
		background-color: gray;
	}
</style>
