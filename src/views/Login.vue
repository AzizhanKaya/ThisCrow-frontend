<script setup lang="ts">
	import { ref } from 'vue';
	import { login } from '@/api/auth';
	import { Icon } from '@iconify/vue';
	import Toast from '@/components/Toast.vue';
	import { websocketService } from '@/services/websocket';
	import { useKeyStore } from '@/stores/key';
	import { useRouter } from 'vue-router';

	const keyStore = useKeyStore();
	const router = useRouter();

	const username = ref('');
	const password = ref('');

	const error = ref<any>(null);
	let isLoading = ref(false);

	async function submit() {
		error.value = null;
		isLoading.value = true;
		try {
			await login(username.value, password.value);
			keyStore.init(password.value);
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
	<div class="login">
		<Toast v-if="error" :message="error" @close="error = null" />

		<form @submit.prevent="submit">
			<div class="field">
				<label>Username</label>
				<Icon icon="mdi:user" class="icon" />
				<input id="username" type="text" v-model="username" required placeholder="Username" />
			</div>
			<div class="field">
				<label>Password</label>
				<Icon icon="fa6-solid:lock" class="icon" />
				<input id="password" type="password" v-model="password" required placeholder="Password" />
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
		color: var(--text);
	}

	input {
		width: 100%;
		padding: 8px;
		box-sizing: border-box;
		border-radius: 4px;
		background-color: var(--bg-darker);
		border: 2px solid transparent;
		font-size: 1rem;
		border-radius: 5px;
		outline: none;
		transition: 0.5s ease;
		font-weight: 200;
		padding-left: 40px;
		color: var(--text);
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

	button {
		width: 100%;
		padding: 16px;
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

	button:hover {
		background: var(--color-dark);
	}
</style>
