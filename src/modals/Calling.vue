<script setup lang="ts">
	import { computed, onMounted, onUnmounted } from 'vue';
	import { Icon } from '@iconify/vue';
	import { useVoiceStore } from '@/stores/voice';
	import { useModalStore } from '@/stores/modal';
	import { useUserStore } from '@/stores/user';
	import type { User } from '@/types';
	import { getDefaultAvatar } from '@/utils/avatar';
	import { useRouter } from 'vue-router';

	const voiceStore = useVoiceStore();
	const modalStore = useModalStore();
	const router = useRouter();

	const targetUser = computed<User | null>(() => modalStore.data?.user || null);

	const handleAnswer = async () => {
		if (!targetUser.value) return;
		const user = targetUser.value;
		await voiceStore.joinVoice(undefined, undefined, user);
		modalStore.closeModal();
		router.push({ name: 'user', params: { userId: user.id } });
	};

	const handleDecline = async () => {
		await voiceStore.leaveVoice();
		modalStore.closeModal();
	};
</script>

<template>
	<div class="modal-backdrop" @click="handleDecline">
		<div class="modal-container calling-modal" @click.stop>
			<div class="calling-content">
				<div class="avatar-section">
					<div class="avatar-ring is-ringing">
						<img :src="targetUser?.avatar || getDefaultAvatar(targetUser?.username || '')" alt="avatar" />
					</div>
				</div>

				<div class="user-info">
					<h2>{{ targetUser?.name }}</h2>
					<span class="status-text"> Incoming Call... </span>
				</div>

				<div class="action-buttons">
					<button class="action-btn answer-btn" @click="handleAnswer">
						<Icon icon="mdi:phone" />
						<span>Answer</span>
					</button>
					<button class="action-btn decline-btn" @click="handleDecline">
						<Icon icon="mdi:phone-hangup" />
						<span>Decline</span>
					</button>
				</div>
			</div>
		</div>
	</div>
</template>

<style scoped>
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		background-color: var(--overlay);
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		backdrop-filter: blur(4px);
	}

	.modal-container {
		background-color: var(--bg);
		width: 320px;
		border-radius: 20px;
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
		overflow: hidden;
		border: 1px solid var(--border);
		padding: 40px 24px;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.calling-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 24px;
		width: 100%;
	}

	.avatar-section {
		position: relative;
	}

	.avatar-ring {
		width: 120px;
		height: 120px;
		border-radius: 50%;
		padding: 4px;
		background: var(--bg-dark);
		position: relative;
	}

	.avatar-ring img {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		object-fit: cover;
	}

	.is-ringing::before {
		content: '';
		position: absolute;
		top: -4px;
		left: -4px;
		right: -4px;
		bottom: -4px;
		border-radius: 50%;
		border: 2px solid var(--success);
		animation: pulse 2s infinite;
	}

	@keyframes pulse {
		0% {
			transform: scale(1);
			opacity: 1;
		}
		100% {
			transform: scale(1.4);
			opacity: 0;
		}
	}

	.user-info {
		text-align: center;
	}

	.user-info h2 {
		margin: 0;
		font-size: 1.5rem;
		color: var(--text);
		font-weight: 700;
	}

	.status-text {
		color: var(--text-muted);
		font-size: 0.9rem;
		margin-top: 4px;
		display: block;
	}

	.action-buttons {
		display: flex;
		gap: 20px;
		width: 100%;
		justify-content: center;
		margin-top: 12px;
	}

	.action-btn {
		width: 60px;
		height: 60px;
		border-radius: 50%;
		border: none;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.2s;
		color: white;
		position: relative;
	}

	.action-btn span {
		position: absolute;
		bottom: -24px;
		font-size: 0.75rem;
		color: var(--text-muted);
		font-weight: 500;
	}

	.action-btn svg {
		font-size: 28px;
	}

	.answer-btn {
		background-color: var(--success);
	}

	.answer-btn:hover {
		background-color: var(--success-hover);
		transform: scale(1.05);
	}

	.decline-btn {
		background-color: var(--error);
	}

	.decline-btn:hover {
		background-color: var(--error-hover);
		transform: scale(1.05);
	}
</style>
