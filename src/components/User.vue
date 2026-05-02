<script lang="ts">
	import type { PropType } from 'vue';
	import { type User, Status } from '@/types';
	import { getDefaultAvatar } from '@/utils/avatar';
	import ProfileCard from '@/components/ProfileCard.vue';
	import { Icon } from '@iconify/vue';
	import { useDMStore } from '@/stores/dm';

	export default {
		components: {
			ProfileCard,
			Icon,
		},
		props: {
			user: {
				type: Object as PropType<User>,
				required: true,
			},
		},
		data() {
			return {
				profileCard: { show: false, x: 0, y: 0 },
			};
		},
		methods: {
			getDefaultAvatar,
			openProfileCard(e: MouseEvent) {
				if (this.profileCard.show) {
					this.profileCard.show = false;
					return;
				}
				document.dispatchEvent(new Event('click')); // Close any other open popovers
				const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
				this.profileCard = { show: true, x: rect.right + 10, y: rect.top };
			},
			handleRemoveDM() {
				const dmStore = useDMStore();
				dmStore.removeDM(this.user.id);
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
		<img class="avatar" :src="user.avatar || getDefaultAvatar(user.username)" />

		<span class="name" @click.stop="openProfileCard($event)">{{ user.name }}</span>
		<span class="username">@{{ user.username }}</span>
		<div class="status" :class="'status-' + getStatus"></div>
		<div class="remove-dm" @click="handleRemoveDM()">
			<Icon icon="mdi:remove"></Icon>
		</div>

		<ProfileCard :user="user" :show="profileCard.show" :x="profileCard.x" :y="profileCard.y" @close="profileCard.show = false" />
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
		background-color: var(--bg-light);
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
		font-size: 1.1rem;
		color: #dbdbdb;
		position: absolute;
		top: 8px;
		left: 60px;
	}

	.name:hover {
		text-decoration: underline;
		cursor: pointer;
	}

	.username {
		font-size: 0.8rem;
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
		left: 38px;
		bottom: 5px;
	}

	.remove-dm {
		position: absolute;
		top: 50%;
		right: 15px;
		transform: translateY(-50%);
		display: flex;
		align-items: center;
		justify-content: center;

		opacity: 0;
		pointer-events: none;
		transition: opacity 0.2s ease;
	}

	.user:hover .remove-dm {
		opacity: 1;
		pointer-events: auto;
	}

	.remove-dm:hover {
		color: var(--text-error);
	}
</style>
