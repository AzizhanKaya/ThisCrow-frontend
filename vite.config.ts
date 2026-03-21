import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import ReactivityTransform from '@vue-macros/reactivity-transform/vite';

// https://vite.dev/config/
export default defineConfig({
	plugins: [vue(), ReactivityTransform()],
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url)),
		},
	},
	server: {
		allowedHosts: ['thiscrow.local'],
	},
});
