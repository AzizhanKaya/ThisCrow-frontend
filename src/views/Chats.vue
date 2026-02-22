<script setup lang="ts">
	import { computed, ref, watch } from 'vue';
	import type { id } from '@/types';
	import User from '@/components/User.vue';
	import type { User as UserType } from '@/types';
	import UserCard from '@/components/UserCard.vue';
	import { useDMStore } from '@/stores/dm';
	import { useUserStore } from '@/stores/user';
	import { useRouter, useRoute } from 'vue-router';
	import AsideButton from '@/components/AsideButton.vue';
	import { RouterView } from 'vue-router';

	const dmStore = useDMStore();
	const userStore = useUserStore();

	const router = useRouter();
	const route = useRoute();
	const user_id = computed(() => route.params.userId as string);

	watch(
		user_id,
		(id) => {
			if (id) dmStore.ensureUser(BigInt(id));
		},
		{ immediate: true }
	);

	function handleUserClick(user: UserType) {
		router.push({ name: 'user', params: { userId: user.id.toString() } });
	}
</script>

<template>
	<div class="chats-view">
		<aside>
			<AsideButton icon="mdi:account-multiple" name="Friends" route="/friends" />
			<div class="separator"></div>

			<div class="user-list">
				<template v-for="(user, index) in dmStore.dms" :key="user.id.toString()">
					<User :user="user" @click="handleUserClick(user)" :class="{ selected: user_id === user.id.toString() }" />
					<div v-if="index < dmStore.dms.length - 1" class="user-separator"></div>
				</template>
			</div>

			<UserCard />
		</aside>
		<main>
			<router-view />
		</main>
	</div>
</template>

<style scoped>
	.chats-view {
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
		transition: opacity 0.07s ease-in-out;
	}
	.fade-enter-from,
	.fade-leave-to {
		opacity: 0;
	}
</style>
