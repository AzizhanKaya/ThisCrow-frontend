<script setup lang="ts">
	import { computed, ref, watch } from 'vue';
	import User from '@/components/User.vue';
	import Chat from '@/views/Chat.vue';
	import type { User as UserType } from '@/types';
	import UserCard from '@/components/UserCard.vue';
	import { useDMStore } from '@/stores/dm';
	import { useRouter, useRoute } from 'vue-router';
	import { getUser } from '@/api/state';
	import AsideButton from '@/components/AsideButton.vue';
	import { RouterView } from 'vue-router';

	const dmStore = useDMStore();

	const router = useRouter();
	const route = useRoute();
	const user_id = computed(() => route.params.userId as string);
	const user = computed(() => dmStore.getUser(user_id.value));

	watch(
		user_id,
		(id) => {
			if (id) dmStore.ensureUser(id);
		},
		{ immediate: true }
	);

	function handleUserClick(user: UserType) {
		router.push({ name: 'user', params: { userId: user.id } });
	}
</script>

<template>
	<div class="container">
		<aside>
			<AsideButton icon="mdi:account-multiple" name="Friends" route="/friends" />
			<div class="separator"></div>

			<div class="user-list">
				<template v-for="(user, index) in dmStore.dms" :key="user.id">
					<User :user="user" @click="handleUserClick(user)" :class="{ selected: user_id === user.id }" />
					<div v-if="index < dmStore.dms.length - 1" class="user-separator"></div>
				</template>
			</div>

			<UserCard />
		</aside>
		<main>
			<router-view v-slot="{ Component }">
				<Transition name="fade" mode="out-in">
					<component v-if="Component" :is="Component" :key="route.path" />
				</Transition>
			</router-view>
		</main>
	</div>
</template>

<style scoped>
	.container {
		display: grid;
		grid-template-columns: clamp(200px, 20%, 300px) 1fr;
		height: 100%;
		position: relative;
	}

	.button-container {
		display: flex;
		flex-direction: column;
	}

	.separator {
		height: 1px;
		background-color: var(--border);
		margin: 10px 0px;
	}

	aside {
		background-color: var(--bg-dark);
		border: 1px solid var(--border);
		padding-top: 10px;
		border-top-left-radius: 20px;
		position: relative;
	}

	.user-list {
		display: flex;
		flex-direction: column;
		padding: 10px;
		gap: 5px;
	}

	.user-list * {
		transition: background-color 0.3s;
	}

	.user-separator {
		height: 1px;
		background-color: var(--border);
		margin-left: 50px;
	}

	main {
		background-color: var(--bg);
		position: relative;
		height: 100%;
	}

	.selected {
		background-color: #535353;
	}

	.selected:hover {
		background-color: #666666;
	}

	.fade-enter-active,
	.fade-leave-active {
		transition: opacity 0.07s ease-in;
	}
	.fade-enter-from,
	.fade-leave-to {
		opacity: 0;
	}
</style>
