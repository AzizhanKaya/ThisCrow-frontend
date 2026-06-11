<script lang="ts">
	import type { PropType } from 'vue';
	import { type User, Status } from '@/types';
	import { getDefaultAvatar } from '@/utils/avatar';
	import { Icon } from '@iconify/vue';
	import { useDMStore } from '@/stores/dm';
	import { useVoiceStore } from '@/stores/voice';
	import { useProfileCardStore } from '@/stores/profileCard';

	export default {
		components: {
			Icon,
		},
		props: {
			user: {
				type: Object as PropType<User>,
				required: true,
			},
		},
		methods: {
			getDefaultAvatar,
			openProfileCard(e: MouseEvent) {
				const target = e.currentTarget as HTMLElement;
				const rect = target.getBoundingClientRect();
				useProfileCardStore().open({
					target,
					x: rect.right + 10,
					y: rect.top,
					user: this.user as User,
				});
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
			isOnVoice(): boolean {
				const voiceStore = useVoiceStore();
				return voiceStore.on_voice_direct.includes((this.user as User).id);
			},
		},
	};
</script>

<template>
	<div class="user">
		<img class="avatar" :src="user.avatar || getDefaultAvatar(user.username)" />

		<div class="user-info">
			<span class="name" @click.stop="openProfileCard($event)">{{ user.name }}</span>
			<span class="username">@{{ user.username }}</span>
		</div>

		<div class="user-actions">
			<div v-if="isOnVoice" class="voice-indicator" title="In voice call">
				<Icon icon="mdi:phone-in-talk" />
			</div>
			<div class="remove-dm" @click.stop="handleRemoveDM()">
				<Icon icon="mdi:remove"></Icon>
			</div>
		</div>

		<div class="status" :class="'status-' + getStatus"></div>
	</div>
</template>

<style scoped>
	.user {
		height: 50px;
		border-radius: 10px;
		position: relative;
		display: flex;
		align-items: center;
		padding-right: 8px;
		min-width: 0;
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
		flex-shrink: 0;
	}

	.user-info {
		display: flex;
		flex-direction: column;
		justify-content: center;
		min-width: 0;
		flex: 0 1 auto;
		padding-left: 4px;
	}

	.name {
		font-weight: bold;
		font-size: 1.1rem;
		color: #dbdbdb;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.name:hover {
		text-decoration: underline;
		cursor: pointer;
	}

	.username {
		font-size: 0.8rem;
		color: #bebebe;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
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

	.user-actions {
		display: flex;
		align-items: center;
		gap: 4px;
		flex-shrink: 0;
		margin-left: auto;
	}

	.voice-indicator {
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--success);
		font-size: 1.2rem;
		transform: scaleX(-1);
	}

	.remove-dm {
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
