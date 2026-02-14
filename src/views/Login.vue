<script setup lang="ts">
	import { ref } from 'vue';
	import { login } from '@/api/auth';
	import { Icon } from '@iconify/vue';
	import Toast from '@/components/Toast.vue';
	import { useUserStore } from '@/stores/user';
	import { useRouter } from 'vue-router';
	import { initApp } from '@/init';

	const userStore = useUserStore();
	const router = useRouter();

	const username = ref('');
	const password = ref('');

	const error = ref<any>(null);
	let isLoading = ref(false);

	async function submit() {
		error.value = null;
		isLoading.value = true;
		try {
			userStore.user = await login(username.value, password.value);
			await initApp();
			router.push('/');
		} catch (err: any) {
			console.error(err);
			error.value = err?.message || 'An error occurred';
		} finally {
			isLoading.value = false;
		}
	}
</script>

<template>
	<div class="login">
		<Toast v-if="error" :message="error" />

		<form @submit.prevent="submit">
			<div class="field">
				<label>Username</label>
				<Icon icon="mdi:user" class="icon" />
				<input type="username" v-model="username" required placeholder="Username" />
			</div>
			<div class="field">
				<label>Password</label>
				<Icon icon="fa6-solid:lock" class="icon" />
				<input type="password" v-model="password" required placeholder="Password" />
			</div>
			<button type="submit">Login</button>
		</form>
	</div>
</template>

<style scoped>
	form {
		text-align: left;
	}

	.field {
		margin-bottom: 16px;
		position: relative;
	}

	label {
		display: block;
		font-weight: 600;
		margin-bottom: 0.25rem;
		padding: 10px 0px;
	}

	.icon {
		position: absolute;
		width: 24px;
		height: 24px;
		left: 8px;
		top: 48px;
		color: #e9e9e9;
	}

	input {
		width: 100%;
		padding: 0.5rem;
		box-sizing: border-box;
		border-radius: 4px;
		background-color: #272727;
		border: 2px solid transparent;
		font-size: 1rem;
		border-radius: 5px;
		outline: none;
		transition: 0.5s ease;
		font-weight: 200;
		padding-left: 40px;
		color: #e9e9e9;
	}

	button {
		width: 100%;
		padding: 1rem;
		background: #6427d6;
		border: none;
		margin-top: 10px;
		font-weight: 600;
		border-radius: 4px;
		cursor: pointer;
		transition: background-color 0.3s;
		color: white;
		font-size: 1rem;
	}

	button:hover {
		background: #4b1f9e;
	}
</style>
