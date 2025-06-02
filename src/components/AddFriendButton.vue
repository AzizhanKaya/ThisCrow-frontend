<script setup lang="ts">
	import { Icon } from '@iconify/vue';
	import AddFriend from '@/modals/AddFriend.vue';
	import { ref } from 'vue';

	const isModalOpen = ref(false);

	const openModal = () => {
		isModalOpen.value = true;
	};
</script>

<template>
	<div class="add-friend" @click="openModal">
		<Icon icon="fluent-mdl2:add-friend" class="icon" />
		<span>Add Friend</span>
	</div>

	<Teleport to="#app">
		<transition name="fade" class="fade">
			<AddFriend v-if="isModalOpen" v-model:isModalOpen="isModalOpen" />
		</transition>
	</Teleport>
</template>

<style scoped>
	.fade-enter-active,
	.fade-leave-active {
		transition: opacity 0.2s;
	}
	.fade-enter-from,
	.fade-leave-to {
		opacity: 0;
	}

	.add-friend {
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

	.add-friend:hover {
		background-color: #5020aa;
	}

	.icon {
		height: 20px;
		width: 20px;
	}
</style>
