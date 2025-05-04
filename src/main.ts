import { createApp } from 'vue';
import App from './App.vue';

async function setupMockServiceWorker() {
	const { worker } = await import('./mocks/browser');
	await worker.start({
		onUnhandledRequest: 'bypass',
	});
}

setupMockServiceWorker().then(() => {
	const app = createApp(App);

	app.mount('#app');
});
