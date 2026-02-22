<script setup lang="ts">
	import { Status } from '@/types';
	import { computed, ref } from 'vue';
	import { useMeStore } from '@/stores/me';
	import { onClickOutside } from '@vueuse/core';

	const meStore = useMeStore();

	const user = meStore.me!;

	const showStatusMenu = ref(false);

	const getStatus = computed(() => {
		switch (user.status) {
			case Status.Online:
				return 'online';
			case Status.Idle:
				return 'idle';
			case Status.Dnd:
				return 'dnd';
			case Status.Offline:
				return 'offline';
		}
	});

	const changeStatus = (newStatus: Status) => {
		meStore.changeStatus(newStatus);
		showStatusMenu.value = false;
	};

	const statusContainer = ref(null);

	onClickOutside(statusContainer, () => {
		showStatusMenu.value = false;
	});
</script>

<template>
	<div class="user-card">
		<img class="avatar" :src="user.avatar || '/default-user-icon.png'" />

		<div class="names">
			<span class="name">{{ user.name }}</span>
			<span class="username">@{{ user.username }}</span>
		</div>

		<div ref="statusContainer" class="status-container" @click="showStatusMenu = !showStatusMenu">
			<div class="status" :class="getStatus"></div>

			<Transition name="fade">
				<div v-if="showStatusMenu" class="status-menu" @click.stop>
					<div v-for="status in Object.values(Status)" :key="status" class="status-option" @click="changeStatus(status)">
						<div class="status-indicator" :class="status.toLowerCase()"></div>
						<span>{{ status }}</span>
					</div>
				</div>
			</Transition>
		</div>
	</div>
</template>

<style scoped>
	.user-card {
		position: absolute;
		bottom: 20px;
		width: 90%;
		left: 5%;
		background-color: var(--bg);
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
		background-color: var(--bg-light);
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

	.status-container {
		margin-left: auto;
		margin-right: 10px;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}

	.status {
		height: 20px;
		aspect-ratio: 1;
		border-radius: 50%;
		border: 2px #333 solid;
		transition: transform 0.2s ease;
	}

	.status-container:hover .status {
		transform: scale(1.1);
	}

	.status-menu {
		position: absolute;
		bottom: 35px;
		background-color: #1e1e1e;
		border-radius: 12px;
		padding: 8px;
		width: 140px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
		display: flex;
		flex-direction: column;
		gap: 4px;
		z-index: 100;
		border: 1px solid #333;
	}

	.status-option {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 12px;
		border-radius: 8px;
		color: #dbdbdb;
		cursor: pointer;
		transition:
			background-color 0.2s,
			color 0.2s;
		font-weight: 500;
		font-size: 0.95rem;
	}

	.status-option:hover {
		background-color: #333;
		color: #fff;
	}

	.status-indicator {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.fade-enter-active,
	.fade-leave-active {
		transition:
			opacity 0.2s ease,
			transform 0.2s ease;
	}

	.fade-enter-from,
	.fade-leave-to {
		opacity: 0;
		transform: translateY(10px) scale(0.95);
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
