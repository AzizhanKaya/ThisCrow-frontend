<script setup lang="ts">
	import { ref, onMounted, onUnmounted, computed } from 'vue';
	import { Icon } from '@iconify/vue';
	import { useModalStore } from '@/stores/modal';
	import { invoke } from '@tauri-apps/api/core';
	import type { id } from '@/types';
	import { useWatchStore } from '@/stores/watch';

	const modalStore = useModalStore();

	enum Browser {
		Chrome = 'Chrome',
		Chromium = 'Chromium',
		Safari = 'Safari',
		Brave = 'Brave',
		Opera = 'Opera',
	}

	const server_id = $computed(() => modalStore.data.server_id as id);
	const channel_id = $computed(() => modalStore.data.channel_id as id);

	const browsers = ref<Browser[]>([]);
	const selectedBrowser = ref<Browser | null>(null);
	const selectedPlatform = ref({ name: 'Netflix', icon: 'logos:netflix-icon' });
	const isLoading = ref(true);

	const showBrowserDropdown = ref(false);
	const showPlatformDropdown = ref(false);

	const platforms = [{ name: 'Netflix', icon: 'logos:netflix-icon' }];

	const getBrowserIcon = (kind: string) => {
		switch (kind.toLowerCase()) {
			case 'chrome':
				return 'logos:chrome';
			case 'chromium':
				return 'logos:chromium';
			case 'safari':
				return 'logos:safari';
			case 'brave':
				return 'logos:brave';
			case 'opera':
				return 'logos:opera';
			default:
				return 'mdi:web';
		}
	};

	onMounted(async () => {
		try {
			browsers.value = await invoke('get_browsers');
			if (browsers.value.length > 0) {
				selectedBrowser.value = browsers.value[0];
			}
		} catch (err) {
			console.error('Failed to fetch browsers:', err);
		} finally {
			isLoading.value = false;
		}

		window.addEventListener('click', closeDropdowns);
	});

	onUnmounted(() => {
		window.removeEventListener('click', closeDropdowns);
	});

	const closeDropdowns = () => {
		showBrowserDropdown.value = false;
		showPlatformDropdown.value = false;
	};

	const toggleBrowserDropdown = (e: MouseEvent) => {
		e.stopPropagation();
		showBrowserDropdown.value = !showBrowserDropdown.value;
		showPlatformDropdown.value = false;
	};

	const togglePlatformDropdown = (e: MouseEvent) => {
		e.stopPropagation();
		showPlatformDropdown.value = !showPlatformDropdown.value;
		showBrowserDropdown.value = false;
	};

	const selectBrowser = (browser: Browser) => {
		selectedBrowser.value = browser;
		showBrowserDropdown.value = false;
	};

	const selectPlatform = (platform: any) => {
		selectedPlatform.value = platform;
		showPlatformDropdown.value = false;
	};

	const startWatchParty = async () => {
		if (!selectedBrowser.value) return;

		try {
			await invoke('open_party', {
				browser: selectedBrowser.value,
				platform: selectedPlatform.value.name,
			});

			const watchStore = useWatchStore();
			watchStore.watch_party = {};

			modalStore.closeModal();
		} catch (err) {
			console.error('Failed to start watch party:', err);
		}
	};
</script>

<template>
	<div class="modal-backdrop" @click="modalStore.closeModal">
		<div class="modal-container" @click.stop>
			<header class="modal-header">
				<div class="title-group">
					<h2>Watch Party</h2>
					<span class="subtitle">Select a browser and platform to start watching together.</span>
				</div>
				<button class="close-btn" @click="modalStore.closeModal">
					<Icon icon="mdi:close" />
				</button>
			</header>

			<div class="modal-content">
				<!-- Browser Select -->
				<div class="form-group">
					<label>Browser</label>
					<div class="custom-select-container" v-if="!isLoading && browsers.length > 0">
						<div class="select-trigger" @click="toggleBrowserDropdown">
							<div class="selected-content" v-if="selectedBrowser">
								<Icon :icon="getBrowserIcon(selectedBrowser)" />
								<span>{{ selectedBrowser }}</span>
							</div>
							<Icon icon="mdi:chevron-down" class="chevron" :class="{ rotated: showBrowserDropdown }" />
						</div>

						<Transition name="slide-up">
							<div class="dropdown-list" v-if="showBrowserDropdown">
								<div
									v-for="browser in browsers"
									:key="browser"
									class="dropdown-item"
									:class="{ active: selectedBrowser === browser }"
									@click="selectBrowser(browser)"
								>
									<Icon :icon="getBrowserIcon(browser)" />
									<span>{{ browser }}</span>
									<Icon v-if="selectedBrowser === browser" icon="mdi:check" class="check-icon" />
								</div>
							</div>
						</Transition>
					</div>
					<div v-else-if="isLoading" class="loading-state">
						<Icon icon="eos-icons:loading" class="spin" />
						<span>Searching for browsers...</span>
					</div>
					<div v-else class="error-state">
						<Icon icon="mdi:alert-circle-outline" />
						<span>No compatible browsers found.</span>
					</div>
				</div>

				<!-- Platform Select -->
				<div class="form-group">
					<label>Platform</label>
					<div class="custom-select-container">
						<div class="select-trigger" @click="togglePlatformDropdown">
							<div class="selected-content">
								<Icon :icon="selectedPlatform.icon" />
								<span>{{ selectedPlatform.name }}</span>
							</div>
							<Icon icon="mdi:chevron-down" class="chevron" :class="{ rotated: showPlatformDropdown }" />
						</div>

						<Transition name="slide-up">
							<div class="dropdown-list" v-if="showPlatformDropdown">
								<div
									v-for="platform in platforms"
									:key="platform.name"
									class="dropdown-item"
									:class="{ active: selectedPlatform.name === platform.name }"
									@click="selectPlatform(platform)"
								>
									<Icon :icon="platform.icon" />
									<span>{{ platform.name }}</span>
									<Icon v-if="selectedPlatform.name === platform.name" icon="mdi:check" class="check-icon" />
								</div>
							</div>
						</Transition>
					</div>
				</div>
			</div>

			<footer class="modal-footer">
				<button class="cancel-link" @click="modalStore.closeModal">Cancel</button>
				<button class="start-btn" @click="startWatchParty" :disabled="!selectedBrowser || isLoading">Start Watch Party</button>
			</footer>
		</div>
	</div>
</template>

<style scoped>
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		background-color: var(--overlay);
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.modal-container {
		background-color: var(--bg);
		width: 440px;
		max-width: 95%;
		border-radius: 12px;
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
		overflow: visible;
		border: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		position: relative;
	}

	.modal-header {
		padding: 28px 28px 16px;
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
	}

	.modal-header h2 {
		margin: 0;
		font-size: 1.4rem;
		color: var(--text);
		font-weight: 800;
		letter-spacing: 0.5px;
		margin-bottom: 8px;
	}

	.subtitle {
		color: var(--text-muted);
		font-size: 0.95rem;
		line-height: 1.4;
	}

	.close-btn {
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		font-size: 1.6rem;
		transition: all 0.2s;
		padding: 4px;
		display: flex;
		align-items: center;
		border-radius: 50%;
	}
	.close-btn:hover {
		color: var(--text);
		background-color: var(--bg-light);
	}

	.modal-content {
		padding: 8px 28px 28px;
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.form-group label {
		font-size: 0.75rem;
		font-weight: 800;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.8px;
	}

	.custom-select-container {
		position: relative;
		width: 100%;
	}

	.select-trigger {
		background-color: var(--bg-dark);
		border-radius: 8px;
		padding: 12px 16px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		border: 1px solid var(--border-muted);
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
		cursor: pointer;
		user-select: none;
	}

	.select-trigger:hover {
		border-color: var(--color);
		background-color: var(--bg-lighter);
	}

	.selected-content {
		display: flex;
		align-items: center;
		gap: 14px;
	}

	.selected-content svg {
		font-size: 1.5rem;
	}

	.selected-content span {
		font-weight: 600;
		font-size: 1.05rem;
		color: var(--text);
	}

	.chevron {
		color: var(--text-muted);
		font-size: 1.4rem;
		transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.chevron.rotated {
		transform: rotate(180deg);
		color: var(--color);
	}

	.dropdown-list {
		position: absolute;
		top: calc(100% + 6px);
		left: 0;
		right: 0;
		background-color: var(--bg-dark);
		border: 1px solid var(--border);
		border-radius: 8px;
		z-index: 100;
		overflow: hidden;
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
		padding: 6px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.dropdown-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.15s ease;
		color: var(--text-muted);
	}

	.dropdown-item svg:first-child {
		font-size: 1.4rem;
	}

	.dropdown-item span {
		flex: 1;
		font-weight: 500;
		font-size: 0.95rem;
	}

	.dropdown-item:hover {
		background-color: var(--bg-light);
		color: var(--text);
	}

	.dropdown-item.active {
		background-color: rgba(261, 68, 45, 0.1);
		background-color: var(--bg-lightest);
		color: var(--text);
	}

	.check-icon {
		color: var(--success);
		font-size: 1.2rem;
	}

	.loading-state,
	.error-state {
		background-color: var(--bg-dark);
		border-radius: 8px;
		padding: 14px 18px;
		display: flex;
		align-items: center;
		gap: 14px;
		color: var(--text-muted);
		border: 1px solid var(--border-muted);
	}

	.spin {
		animation: spin 0.8s linear infinite;
		color: var(--color);
		font-size: 1.4rem;
	}

	@keyframes spin {
		100% {
			transform: rotate(360deg);
		}
	}

	.modal-footer {
		padding: 20px 28px;
		background-color: var(--bg-dark);
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: 24px;
		border-top: 1px solid var(--border);
	}

	.cancel-link {
		background: none;
		border: none;
		color: var(--text);
		font-size: 1rem;
		cursor: pointer;
		font-weight: 600;
		padding: 8px;
		border-radius: 4px;
		transition: background-color 0.2s;
	}

	.cancel-link:hover {
		background-color: var(--bg-light);
	}

	.start-btn {
		background-color: var(--color);
		color: white;
		border: none;
		padding: 12px 32px;
		border-radius: 6px;
		font-weight: 700;
		font-size: 1rem;
		cursor: pointer;
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
	}

	.start-btn:hover:not(:disabled) {
		background-color: var(--color-light);
		transform: translateY(-1px);
		box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
	}

	.start-btn:active:not(:disabled) {
		transform: translateY(0);
	}

	.start-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		box-shadow: none;
	}

	/* Transitions */
	.slide-up-enter-active,
	.slide-up-leave-active {
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.slide-up-enter-from,
	.slide-up-leave-to {
		opacity: 0;
		transform: translateY(10px);
	}
</style>
