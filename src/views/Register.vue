<script setup lang="ts">
	import { ref } from 'vue';
	import { Icon } from '@iconify/vue';
	import Toast from '@/components/Toast.vue';
	import { register } from '@/api/auth';

	const username = ref('');
	const name = ref('');
	const email = ref('');
	const password = ref('');
	const confirmPassword = ref('');

	const error = ref<any>(null);
	let isLoading = ref(false);

	async function submit() {
		error.value = null;
		isLoading.value = true;
		try {
			if (password.value !== confirmPassword.value) {
				error.value = 'Passwords does not match';
				isLoading.value = false;
				return;
			}
			await register(username.value, name.value, email.value, password.value);
		} catch (err: any) {
			console.error(err);
			error.value = err?.message || 'An error occurred';
		} finally {
			isLoading.value = false;
		}
	}
</script>

<template>
	<div class="register">
		<Toast v-if="error" :message="error" />

		<form @submit.prevent="submit">
			<div class="field">
				<label>Username</label>
				<Icon icon="mdi:user" class="icon" />
				<input type="text" v-model="username" required placeholder="Username" />
			</div>
			<div class="field">
				<label>Name</label>
				<Icon icon="mdi:user" class="icon" />
				<input type="text" v-model="name" required placeholder="Name" />
			</div>
			<div class="field">
				<label>Email</label>
				<Icon icon="ic:baseline-email" class="icon" />
				<input type="email" v-model="email" required placeholder="Email" />
			</div>
			<div class="field">
				<label>Password</label>
				<Icon icon="fa6-solid:lock" class="icon" />
				<input type="password" v-model="password" required placeholder="Password" />
			</div>
			<div class="field">
				<label>Confirm Password</label>
				<Icon icon="octicon:lock-24" class="icon" />
				<input type="password" v-model="confirmPassword" required placeholder="Confirm Password" />
			</div>
			<button type="submit">Register</button>
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

	input:-webkit-autofill,
	input:-webkit-autofill:hover,
	input:-webkit-autofill:focus,
	input:-webkit-autofill:active {
		-webkit-box-shadow: 0 0 0 30px #272727 inset !important;
		-webkit-text-fill-color: #e9e9e9 !important;
		font-size: 1rem !important;
		font-weight: 200 !important;
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
</style>
