<script setup lang="ts">
	import { State, type AppState } from '@/types';
	import { computed, inject } from 'vue';

	const state = inject<AppState>('state')!;

	const getState = computed(() => {
		switch (state.user.state) {
			case State.Online:
				return 'online';
			case State.Offline:
				return 'offline';
			case State.Dnd:
				return 'dnd';
			default:
				return '';
		}
	});
</script>

<template>
	<div class="user-card">
		<img class="avatar" :src="state.user.avatar || '/default-user-icon.png'" />

		<div class="names">
			<span class="name">{{ state.user.name }}</span>
			<span class="username">@{{ state.user.username }}</span>
		</div>
		<div class="state" :class="getState"></div>
	</div>
</template>

<style scoped>
	.user-card {
		position: absolute;
		bottom: 20px;
		width: 90%;
		left: 5%;
		background-color: #303030;
		padding: 10px;
		border-radius: 10px;
		z-index: 30;
		height: 70px;
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.user-card:hover {
		cursor: pointer;
		background-color: #333;
	}

	.avatar {
		aspect-ratio: 1;
		height: 100%;
		border-radius: 50%;
	}

	.names {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		justify-content: center;
	}

	.name {
		font-weight: bold;
		font-size: 1.2rem;
		color: #dbdbdb;
	}

	.username {
		font-size: 0.9em;
		color: #bebebe;
	}

	.state {
		height: 20px;
		aspect-ratio: 1;
		border-radius: 50%;
		border: 2px #333 solid;
		margin-left: auto;
		margin-right: 10px;
	}

	.online {
		background-color: rgba(4, 206, 4, 0.8);
	}
	.dnd {
		background-color: red;
	}

	.offline {
		background-color: gray;
	}
</style>
