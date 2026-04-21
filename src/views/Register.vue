<script setup lang="ts">
	import { ref } from 'vue';
	import { Icon } from '@iconify/vue';
	import Toast from '@/components/Toast.vue';
	import { register } from '@/api/auth';
	import { generate_keypair } from '../../pkg/wasm_lib';
	import { useKeyStore } from '@/stores/key';
	import { websocketService } from '@/services/websocket';
	import { useRouter } from 'vue-router';

	const keyStore = useKeyStore();
	const router = useRouter();

	const username_ref = ref('');
	const name_ref = ref('');
	const email_ref = ref('');
	const password_ref = ref('');
	const confirmPassword_ref = ref('');

	const error = ref<any>(null);
	const isLoading = ref(false);

	async function submit() {
		error.value = null;
		isLoading.value = true;

		const username = username_ref.value;
		const name = name_ref.value;
		const email = email_ref.value;
		const password = password_ref.value;
		const confirmPassword = confirmPassword_ref.value;

		if (password !== confirmPassword) {
			error.value = 'Passwords does not match';
			isLoading.value = false;
			return;
		}

		try {
			const keypair = generate_keypair(username + ':' + password);
			await register(username, name, email, password, keypair.public_key);
			keyStore.storeKeys(keypair);
			websocketService.connect();
			router.push({ name: 'chats' });
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
		<Toast v-if="error" :message="error" @close="error = null" />

		<form @submit.prevent="submit">
			<div class="field">
				<label>Username</label>
				<Icon icon="mdi:user" class="icon" />
				<input type="text" v-model="username_ref" required placeholder="Username" />
			</div>
			<div class="field">
				<label>Name</label>
				<Icon icon="mdi:user" class="icon" />
				<input type="text" v-model="name_ref" required placeholder="Name" />
			</div>
			<div class="field">
				<label>Email</label>
				<Icon icon="ic:baseline-email" class="icon" />
				<input type="email" v-model="email_ref" required placeholder="Email" />
			</div>
			<div class="field">
				<label>Password</label>
				<Icon icon="fa6-solid:lock" class="icon" />
				<input type="password" v-model="password_ref" required placeholder="Password" />
			</div>
			<div class="field">
				<label>Confirm Password</label>
				<Icon icon="octicon:lock-24" class="icon" />
				<input type="password" v-model="confirmPassword_ref" required placeholder="Confirm Password" />
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
		margin-bottom: 8px;
		position: relative;
	}

	label {
		display: block;
		font-weight: 600;
		padding: 8px 0px;
	}

	.icon {
		position: absolute;
		width: 24px;
		height: 24px;
		left: 10px;
		top: 40px;
		color: #e9e9e9;
	}

	input {
		width: 100%;
		padding: 0.5rem;
		box-sizing: border-box;
		background-color: var(--bg-darker);
		border: 2px solid transparent;
		font-size: 1rem;
		border-radius: 5px;
		outline: none;
		transition: 0.5s ease;
		font-weight: 200;
		padding-left: 40px;
		color: #e9e9e9;
		line-height: 1;
	}

	input:-webkit-autofill,
	input:-webkit-autofill:hover,
	input:-webkit-autofill:focus,
	input:-webkit-autofill:active {
		-webkit-box-shadow: 0 0 0 30px var(--bg-darker) inset !important;
		-webkit-text-fill-color: #e9e9e9 !important;
		font-size: 1rem !important;
		font-weight: 200 !important;
	}

	button[type='submit'] {
		width: 100%;
		padding: 1rem;
		background: var(--color-light);
		border: none;
		margin-top: 12px;
		font-weight: 600;
		border-radius: 4px;
		cursor: pointer;
		transition: background-color 0.3s;
		color: white;
		font-size: 1rem;
	}

	button[type='submit']:hover {
		background: var(--color-dark);
	}
</style>
