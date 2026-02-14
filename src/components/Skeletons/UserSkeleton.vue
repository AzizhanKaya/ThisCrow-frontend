<script lang="ts">
	export default {
		name: 'UserSkeleton',
	};
</script>

<template>
	<div class="user skeleton">
		<div class="avatar skeleton-box"></div>

		<div class="name skeleton-box"></div>
		<div class="username skeleton-box"></div>

		<div class="state skeleton-box"></div>
	</div>
</template>

<style scoped>
	.user {
		height: 50px;
		border-radius: 10px;
		position: relative;
		overflow: hidden;
	}

	.skeleton-box {
		background: linear-gradient(90deg, #2a2a2a 25%, #3a3a3a 37%, #2a2a2a 63%);
		background-size: 400% 100%;
		animation: shimmer 1.4s ease infinite;
	}

	.avatar {
		aspect-ratio: 1;
		height: 100%;
		border-radius: 50%;
		padding: 5px;
		margin-left: 5px;
	}

	.name {
		position: absolute;
		top: 10px;
		left: 60px;
		width: 120px;
		height: 14px;
		border-radius: 4px;
	}

	.username {
		position: absolute;
		top: 30px;
		left: 60px;
		width: 90px;
		height: 12px;
		border-radius: 4px;
	}

	.state {
		height: 12px;
		aspect-ratio: 1;
		border-radius: 50%;
		position: absolute;
		left: 40px;
		bottom: 5px;
		border: 2px #333 solid;
	}

	@keyframes shimmer {
		0% {
			background-position: 100% 0;
		}
		100% {
			background-position: -100% 0;
		}
	}
</style>
