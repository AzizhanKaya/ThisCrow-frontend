import { createApp } from 'vue';
import App from './App.vue';
import router from '@/router.ts';
import { createPinia } from 'pinia';

if (!Array.prototype.hasOwnProperty('last')) {
	Object.defineProperty(Array.prototype, 'last', {
		get() {
			return this[this.length - 1];
		},
		configurable: true,
	});
}

if (!Array.prototype.hasOwnProperty('first')) {
	Object.defineProperty(Array.prototype, 'first', {
		get() {
			return this[0];
		},
		configurable: true,
	});
}

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
app.use(router);
app.mount('#app');
