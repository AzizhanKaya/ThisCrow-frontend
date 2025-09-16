<script setup lang="ts">
	import { Icon } from '@iconify/vue';
	import { ref } from 'vue';
	import { useRouter } from 'vue-router';

	const router = useRouter();
	const openModal = () => {
		router.push('/friends');
	};
</script>

<template>
	<div class="friends-button" @click="openModal">
		<Icon icon="fluent-mdl2:add-friend" class="icon" />
		<span>Friends</span>
	</div>
</template>

<style scoped>
	.friends-button {
		margin-top: 10px;
		margin-inline: auto;
		width: 90%;
		background-color: #303030;
		border-radius: 5px;
		height: 40px;
		display: flex;
		padding-left: 20px;
		align-items: center;
		gap: 20px;
		cursor: pointer;
		transition: background-color 0.3s;
	}

	.friends-button:hover {
		background-color: #5020aa;
	}

	.icon {
		height: 20px;
		width: 20px;
	}
</style>
