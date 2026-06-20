import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import ReactivityTransform from '@vue-macros/reactivity-transform/vite';
import { resolve } from 'path';

// https://vite.dev/config/
export default defineConfig({
	plugins: [vue(), ReactivityTransform()],
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url)),
		},
	},
	server: {
		host: true,
		allowedHosts: true,
		watch: {
			ignored: ['**/src-tauri/**'],
		},
	},
	build: {
		rollupOptions: {
			input: {
				main: resolve(__dirname, 'index.html'),
				updater: resolve(__dirname, 'updater.html'),
			},
		},
	},
});
