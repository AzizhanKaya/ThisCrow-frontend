import { createApp } from 'vue';
import App from './App.vue';
import { state } from './state';

async function setupMockServiceWorker() {
	const { worker } = await import('./mocks/browser');
	await worker.start({
		onUnhandledRequest: 'bypass',
	});
}

const app = createApp(App);
app.provide('state', state);
app.mount('#app');
