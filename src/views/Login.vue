<script setup lang="ts">
	import { ref } from 'vue';
	import { login, register } from '@/api/auth';
	import type { User } from '@/types';
	import { Icon } from '@iconify/vue';
	import Toast from '@/components/Toast.vue';

	const mode = ref<'login' | 'register'>('login');

	const username = ref('');
	const name = ref('');
	const email = ref('');
	const password = ref('');
	const confirmPassword = ref('');

	const error = ref<any>(null);
	let isLoading = ref(false);

	const emit = defineEmits<{
		(e: 'login', payload: User): void;
	}>();

	async function submit() {
		error.value = null;
		isLoading.value = true;

		try {
			switch (mode.value) {
				case 'login': {
					const data = await login(username.value, password.value);

					if (data) {
						emit('login', data);
					}

					break;
				}

				case 'register': {
					console.log(password.value, confirmPassword.value);
					if (password.value !== confirmPassword.value) {
						error.value = 'Passwords does not match';
						isLoading.value = false;
						return;
					}

					const data = await register(username.value, name.value, email.value, password.value);

					if (data) {
						emit('login', data);
					}

					break;
				}
			}
		} catch (err: any) {
			error.value = err?.message || 'An error occurred';
		} finally {
			isLoading.value = false;
		}
	}
</script>

<template>
	<Toast v-if="error" :message="error" />
	<div class="container">
		<div class="card">
			<h2>ThisCrow</h2>
			<div class="buttons">
				<button :class="{ active: mode === 'login' }" @click.prevent="mode = 'login'">Login</button>
				<button :class="{ active: mode === 'register' }" @click.prevent="mode = 'register'">Register</button>
			</div>

			<transition name="fade" mode="out-in">
				<form :key="mode" @submit.prevent="submit">
					<div class="field">
						<label>Username</label>
						<Icon icon="mdi:user" class="icon" />
						<input type="username" v-model="username" required placeholder="Username" />
					</div>
					<div v-if="mode === 'register'" class="field">
						<label>Name</label>
						<Icon icon="mdi:user" class="icon" />
						<input type="name" v-model="name" required placeholder="Name" />
					</div>
					<div v-if="mode === 'register'" class="field">
						<label>Email</label>
						<Icon icon="ic:baseline-email" class="icon" />
						<input type="email" v-model="email" required placeholder="Email" />
					</div>
					<div class="field">
						<label>Password</label>
						<Icon icon="fa6-solid:lock" class="icon" />
						<input type="password" v-model="password" required placeholder="Password" />
					</div>
					<div v-if="mode === 'register'" class="field">
						<label>Confirm Password</label>
						<Icon icon="octicon:lock-24" class="icon" />
						<input type="password" v-model="confirmPassword" required placeholder="Confirm Password" />
					</div>
					<button type="submit">{{ mode === 'login' ? 'Login' : 'Register' }}</button>
				</form>
			</transition>
		</div>
	</div>
</template>

<style scoped>
	h2 {
		padding-bottom: 20px;
		color: #e9e9e9;
	}
	.container {
		height: 100vh;
		display: flex;
		justify-content: center;
		align-items: center;
		background: #303030;
		color: white;
	}

	.card {
		background: #202225;
		padding: 2rem;
		border-radius: 8px;
		width: 400px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		text-align: center;
	}

	.buttons {
		display: flex;
		justify-content: center;
		margin-bottom: 1rem;
	}

	.buttons button {
		flex: 1;
		margin: 6px 8px;
		padding: 8px 5px;
		border: none;
		background: #161616;
		cursor: pointer;
		font-weight: 600;
		border-radius: 4px;
		transition: background-color 0.3s;
		color: white;
		font-size: 1rem;
	}

	.buttons button.active {
		background: #6427d6;
	}

	.buttons button:hover:not(.active) {
		background: #202020;
	}

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
		left: 1px;
		top: 1px;
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

	button[type='submit'] {
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

	button[type='submit']:hover {
		background: #4b1f9e;
	}

	.fade-enter-active,
	.fade-leave-active {
		transition: opacity 0.3s ease;
	}
	.fade-enter-from,
	.fade-leave-to {
		opacity: 0;
	}
</style>
