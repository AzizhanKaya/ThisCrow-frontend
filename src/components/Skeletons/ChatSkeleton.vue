<script setup lang="ts">
	import { ref } from 'vue';

	const SKELETON_COUNT = 30;

	const generateSkeletonData = () => {
		return Array.from({ length: SKELETON_COUNT }).map((_, index) => {
			const hasUser = index === 0 || Math.random() > 0.65;
			const textWidth = Math.floor(Math.random() * (70 - 30) + 10) + '%';

			return {
				id: index,
				hasUser,
				textWidth,
			};
		});
	};

	const skeletonMessages = ref(generateSkeletonData());
</script>

<template>
	<div class="skeleton-container">
		<div v-for="msg in skeletonMessages" :key="msg.id" class="message-skeleton" :class="{ 'with-user': msg.hasUser }">
			<div v-if="msg.hasUser" class="avatar-skeleton skeleton-pulse"></div>

			<div class="content">
				<div v-if="msg.hasUser" class="header-skeleton">
					<div class="name-skeleton skeleton-pulse"></div>
					<div class="time-skeleton skeleton-pulse"></div>
				</div>

				<div class="text-wrapper">
					<div class="text-skeleton skeleton-pulse" :style="{ width: msg.textWidth }"></div>
				</div>
			</div>
		</div>
	</div>
</template>

<style scoped>
	.skeleton-container {
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		width: 100%;
		height: 100%;
		overflow: hidden;
		background-color: transparent;
		padding-bottom: 100px;
	}

	.message-skeleton {
		display: flex;
		gap: 12px;
		padding: 4px 20px;
		width: 100%;
		box-sizing: border-box;
	}

	.message-skeleton:not(.with-user) {
		padding-left: 72px;
		margin-top: 2px;
	}

	.message-skeleton.with-user {
		margin-top: 12px;
	}

	.content {
		display: flex;
		flex-direction: column;
		flex: 1;
		gap: 6px;
	}

	.avatar-skeleton {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.header-skeleton {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 5px;
	}

	.name-skeleton {
		width: 100px;
		height: 14px;
		border-radius: 4px;
	}

	.time-skeleton {
		width: 40px;
		height: 10px;
		border-radius: 2px;
	}

	.text-skeleton {
		height: 16px;
		border-radius: 4px;
	}

	.skeleton-pulse {
		/* Gradient aralığını biraz daralttım (40-50-60) ki kenarlar temiz kalsın */
		background: linear-gradient(135deg, rgba(255, 255, 255, 0.05) 40%, rgba(255, 255, 255, 0.15) 50%, rgba(255, 255, 255, 0.05) 60%);
		/* 400% idealdir, 700% çok büyük olduğu için render hatası yapar */
		background-size: 400% 400%;
		animation: shimmer 1s infinite linear;
	}

	@keyframes shimmer {
		0% {
			background-position: 100% 100%;
		}
		100% {
			background-position: 0% 0%;
		}
	}
</style>
