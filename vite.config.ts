import { fileURLToPath, URL } from 'node:url';

import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import ReactivityTransform from '@vue-macros/reactivity-transform/vite';
import { resolve } from 'path';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), 'VITE_');
	const domain = env.VITE_DOMAIN_ADDRESS || 'localhost';
	const apiPort = env.VITE_API_PORT || '8080';
	const wsPort = env.VITE_WS_PORT || '8081';
	const https = env.VITE_HTTPS === 'true';
	const protocol = https ? 'https' : 'http';

	return {
		plugins: [vue(), ReactivityTransform()],
		resolve: {
			alias: {
				'@': fileURLToPath(new URL('./src', import.meta.url)),
			},
		},
		server: {
			allowedHosts: true,
			proxy: {
				'/api': {
					target: `${protocol}://${domain}:${apiPort}`,
					changeOrigin: true,
				},
				'/ws': {
					target: `${https ? 'wss' : 'ws'}://${domain}:${wsPort}`,
					ws: true,
				},
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
	};
});
