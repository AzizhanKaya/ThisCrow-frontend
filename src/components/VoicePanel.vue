<script setup lang="ts">
	import { useVoiceStore } from '@/stores/voice';
	import { webrtcService } from '@/services/webrtc';
	import { Icon } from '@iconify/vue';
	import { ref, computed, onMounted, onUnmounted } from 'vue';

	const voiceStore = useVoiceStore();
	const panelRef = ref<HTMLElement | null>(null);

	const inputLevelPercent = computed(() => {
		const _ = webrtcService.stateUpdate.value;
		return Math.round(webrtcService.inputLevel.value * 100);
	});

	const connectionStatus = computed(() => {
		const _ = webrtcService.stateUpdate.value;
		const peers = Array.from(webrtcService.pcs.values());

		if (peers.length === 0) return 'connected';

		const anyFailed = peers.some((p) => p.connection.connectionState === 'failed');
		if (anyFailed) return 'failed';

		const allConnected = peers.every((p) => p.connection.connectionState === 'connected');
		if (allConnected) return 'connected';

		return 'connecting';
	});

	const userCount = computed(() => {
		if (!voiceStore.voice_channel?.users) return 0;
		return Array.from(voiceStore.voice_channel.users).length;
	});

	function handleClickOutside(e: MouseEvent) {
		if (panelRef.value && !panelRef.value.contains(e.target as Node)) {
			voiceStore.showDeviceSelector = false;
			voiceStore.showOutputDeviceSelector = false;
		}
	}

	onMounted(() => {
		document.addEventListener('click', handleClickOutside);
	});

	onUnmounted(() => {
		document.removeEventListener('click', handleClickOutside);
	});
</script>

<template>
	<div v-if="voiceStore.voice_channel || voiceStore.voice_direct" class="voice-panel" ref="panelRef">
		<div class="panel-header">
			<div class="voice-info">
				<div class="voice-connection" :class="'status-' + connectionStatus">
					<div class="signal-dot"></div>
					<span class="connection-text" v-if="connectionStatus === 'connected'">Connected</span>
					<span class="connection-text" v-else-if="connectionStatus === 'connecting'">Connecting...</span>
					<span class="connection-text" v-else>Failed</span>
					<span v-if="webrtcService.pcs.size > 0" class="latency-badge">{{ webrtcService.latencyMs.value }}ms</span>
				</div>
				<div class="voice-meta">
					<span class="voice-channel-name">
						{{ voiceStore.voice_channel ? `# ${voiceStore.voice_channel.name}` : `@ ${voiceStore.voice_direct?.name}` }}
					</span>
					<span v-if="voiceStore.voice_channel && userCount > 0" class="voice-user-count">
						<Icon icon="mdi:account-group" />
						{{ userCount }}
					</span>
				</div>
			</div>

			<div class="device-controls">
				<div class="device-control" :class="{ active: voiceStore.isMuted }">
					<button
						class="device-btn"
						:class="{ 'is-active': voiceStore.isMuted }"
						@click.stop="voiceStore.toggleMute()"
						title="Toggle microphone"
					>
						<Icon :icon="voiceStore.isMuted ? 'mdi:microphone-off' : 'mdi:microphone'" />
					</button>
					<button
						class="device-anchor"
						:class="{ 'is-open': voiceStore.showDeviceSelector }"
						@click.stop="voiceStore.toggleDeviceSelector()"
						title="Select input device"
					>
						<Icon icon="mdi:chevron-up" class="anchor-chevron" />
					</button>

					<Transition name="popup">
						<div v-if="voiceStore.showDeviceSelector" class="device-popup" @click.stop>
							<div class="device-popup-header">
								<Icon icon="mdi:microphone-settings" />
								<span>Input Device</span>
							</div>
							<div class="device-list">
								<label
									v-for="device in voiceStore.audioDevices"
									:key="device.deviceId"
									class="device-item"
									:class="{ selected: device.deviceId === voiceStore.selectedDeviceId }"
								>
									<input
										type="radio"
										name="audio-input-device"
										:value="device.deviceId"
										:checked="device.deviceId === voiceStore.selectedDeviceId"
										@change="voiceStore.selectAudioDevice(device.deviceId)"
									/>
									<span class="radio-dot"></span>
									<span class="device-label">{{ device.label }}</span>
								</label>
								<div v-if="voiceStore.audioDevices.length === 0" class="device-empty">No input devices found</div>
							</div>

							<div class="popup-divider"></div>

							<div class="input-meter-section">
								<div class="meter-label">Input Level</div>
								<div class="level-meter">
									<div class="level-fill" :style="{ width: inputLevelPercent + '%' }" :class="{ hot: inputLevelPercent > 80 }"></div>
									<div class="threshold-marker" :style="{ left: (voiceStore.voiceThreshold / 0.15) * 100 + '%' }"></div>
								</div>
							</div>

							<div class="threshold-section">
								<div class="meter-label">Voice Threshold</div>
								<input
									type="range"
									class="threshold-slider"
									min="0"
									max="0.15"
									step="0.001"
									:value="voiceStore.voiceThreshold"
									@input="voiceStore.voiceThreshold = Number(($event.target as HTMLInputElement).value)"
								/>
							</div>

							<div class="popup-divider"></div>

							<label class="toggle-row">
								<span class="toggle-label">Noise Suppression</span>
								<div
									class="toggle-switch"
									:class="{ on: voiceStore.noiseSuppression }"
									@click="voiceStore.noiseSuppression = !voiceStore.noiseSuppression"
								>
									<div class="toggle-knob"></div>
								</div>
							</label>
						</div>
					</Transition>
				</div>

				<div class="device-control" :class="{ active: voiceStore.isDeafened }">
					<button
						class="device-btn"
						:class="{ 'is-active': voiceStore.isDeafened }"
						@click.stop="voiceStore.toggleDeafen()"
						title="Toggle deafen"
					>
						<Icon :icon="voiceStore.isDeafened ? 'mdi:headphones-off' : 'mdi:headphones'" />
					</button>
					<button
						class="device-anchor"
						:class="{ 'is-open': voiceStore.showOutputDeviceSelector }"
						@click.stop="voiceStore.toggleOutputDeviceSelector()"
						title="Select output device"
					>
						<Icon icon="mdi:chevron-up" class="anchor-chevron" />
					</button>

					<Transition name="popup">
						<div v-if="voiceStore.showOutputDeviceSelector" class="device-popup" @click.stop>
							<div class="device-popup-header">
								<Icon icon="mdi:speaker" />
								<span>Output Device</span>
							</div>
							<div class="device-list">
								<label
									v-for="device in voiceStore.outputDevices"
									:key="device.deviceId"
									class="device-item"
									:class="{ selected: device.deviceId === voiceStore.selectedOutputDeviceId }"
								>
									<input
										type="radio"
										name="audio-output-device"
										:value="device.deviceId"
										:checked="device.deviceId === voiceStore.selectedOutputDeviceId"
										@change="voiceStore.selectOutputDevice(device.deviceId)"
									/>
									<span class="radio-dot"></span>
									<span class="device-label">{{ device.label }}</span>
								</label>
								<div v-if="voiceStore.outputDevices.length === 0" class="device-empty">No output devices found</div>
							</div>
						</div>
					</Transition>
				</div>
			</div>
		</div>

		<div class="panel-actions">
			<button
				class="panel-btn"
				:class="{ 'is-active': voiceStore.isVideoOn }"
				@click.stop="voiceStore.toggleVideo()"
				title="Toggle video"
			>
				<Icon :icon="voiceStore.isVideoOn ? 'mdi:video' : 'mdi:video-off'" />
			</button>
			<button
				class="panel-btn"
				:class="{ 'is-active': voiceStore.isScreenSharing }"
				@click.stop="voiceStore.toggleScreen()"
				title="Toggle screen share"
			>
				<Icon :icon="voiceStore.isScreenSharing ? 'mdi:monitor-share' : 'ic:round-stop-screen-share'" />
			</button>
			<button class="panel-btn danger" @click.stop="voiceStore.leaveVoice()" title="Disconnect">
				<Icon icon="mdi:phone-hangup" />
			</button>
		</div>
	</div>
</template>

<style scoped>
	.voice-panel {
		background: linear-gradient(180deg, var(--bg-darker) 0%, var(--bg-darkest) 100%);
		border-radius: 12px 12px 0 0;
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		position: relative;
		bottom: -4px;
		box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.4);
		border-top: 1px solid rgba(255, 255, 255, 0.05);
		container-type: inline-size;
	}

	.panel-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 6px;
		flex-wrap: wrap;
	}

	.voice-info {
		display: flex;
		flex-direction: column;
		gap: 0px;
		min-width: 0;
		flex: 1;
	}

	.voice-connection {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--success);
		font-weight: 700;
		font-size: 0.85rem;
		letter-spacing: 0.01em;
		transition: all 0.3s ease;
		white-space: nowrap;
	}

	@container (max-width: 210px) {
		.connection-text {
			display: none;
		}
	}

	.latency-badge {
		font-size: 0.65rem;
		font-weight: 600;
		color: var(--text-muted);
		background: rgba(255, 255, 255, 0.05);
		padding: 1px 5px;
		border-radius: 4px;
		margin-left: 2px;
	}

	.voice-connection.status-connecting {
		color: var(--warning, #faa61a);
	}

	.voice-connection.status-failed {
		color: var(--error);
	}

	.signal-dot {
		width: 8px;
		height: 8px;
		min-width: 8px;
		border-radius: 50%;
		background: var(--success);
		box-shadow: 0 0 8px var(--success);
		position: relative;
	}

	.status-connected .signal-dot::after {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		border-radius: 50%;
		background: inherit;
		animation: pulse-ring 2s cubic-bezier(0.455, 0.03, 0.515, 0.955) infinite;
	}

	@keyframes pulse-ring {
		0% {
			transform: scale(0.7);
			opacity: 0.8;
		}
		80%,
		100% {
			transform: scale(2.2);
			opacity: 0;
		}
	}

	.status-connecting .signal-dot {
		background: var(--warning, #faa61a);
		box-shadow: 0 0 6px var(--warning, #faa61a);
		animation: dot-blink 1s ease-in-out infinite;
	}

	.status-failed .signal-dot {
		background: var(--error);
		box-shadow: 0 0 6px var(--error);
		animation: none;
	}

	.status-connected .signal-dot {
		animation: none;
	}

	@keyframes dot-blink {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.3;
		}
	}

	.voice-meta {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
	}

	.voice-channel-name {
		font-size: 0.75rem;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}

	.voice-user-count {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 0.68rem;
		font-weight: 600;
		color: var(--text-muted);
		background: rgba(255, 255, 255, 0.03);
		padding: 2px 6px;
		border-radius: 10px;
		border: 1px solid rgba(255, 255, 255, 0.05);
	}

	.voice-user-count .iconify {
		font-size: 0.78rem;
	}

	.device-controls {
		display: flex;
		gap: 4px;
		flex-shrink: 0;
	}

	.device-control {
		position: relative;
		width: 38px;
		height: 38px;
		flex-shrink: 0;
	}

	.device-btn {
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.05);
		color: var(--text-muted);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		width: 100%;
		height: 100%;
		border-radius: 10px;
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
		font-size: 1.2rem;
	}

	.device-btn:hover {
		color: var(--text);
		background: var(--bg-light);
	}

	.device-btn.is-active {
		color: var(--error);
		background: rgba(var(--error-rgb, 240, 71, 71), 0.1);
		border-color: rgba(var(--error-rgb, 240, 71, 71), 0.2);
	}

	.device-btn.is-active:hover {
		background: rgba(var(--error-rgb, 240, 71, 71), 0.15);
		border-color: rgba(var(--error-rgb, 240, 71, 71), 0.3);
	}

	.device-anchor {
		position: absolute;
		top: 0;
		right: 0;
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		width: 14px;
		height: 14px;
		transition: all 0.15s ease;
		font-size: 0.7rem;
		z-index: 2;
		opacity: 0.5;
	}

	.device-anchor:hover {
		color: var(--text);
		opacity: 1;
	}

	.device-anchor.is-open {
		color: var(--text);
		opacity: 1;
	}

	.anchor-chevron {
		transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.device-anchor.is-open .anchor-chevron {
		transform: rotate(180deg);
	}

	.panel-actions {
		display: flex;
		gap: 4px;
	}

	.panel-btn {
		flex: 1;
		min-width: 0;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.05);
		color: var(--text-muted);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 8px;
		border-radius: 8px;
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
		font-size: 1.1rem;
	}

	.panel-btn:hover {
		color: var(--text);
		background: var(--bg-light);
	}

	.panel-btn.is-active {
		color: var(--success);
	}

	.panel-btn.danger {
		color: var(--error);
	}

	.panel-btn.danger:hover {
		background: var(--error);
		color: var(--text);
	}

	.device-popup {
		position: absolute;
		bottom: calc(100% + 6px);
		left: 0;
		min-width: 250px;
		max-width: 310px;
		background-color: var(--bg-darker);
		border: 1px solid rgba(255, 255, 255, 0.07);
		border-radius: 10px;
		padding: 8px;
		z-index: 200;
		box-shadow:
			0 12px 40px rgba(0, 0, 0, 0.55),
			0 4px 12px rgba(0, 0, 0, 0.3);
	}

	.device-popup-header {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--text-muted);
		font-size: 0.68rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: 4px 8px 8px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.05);
		margin-bottom: 4px;
	}

	.device-popup-header .iconify {
		font-size: 0.82rem;
	}

	.device-list {
		display: flex;
		flex-direction: column;
		gap: 1px;
		max-height: 180px;
		overflow-y: auto;
	}

	.device-item {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 7px 10px;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.12s ease;
		color: var(--text-muted);
		font-size: 0.8rem;
	}

	.device-item:hover {
		background-color: rgba(255, 255, 255, 0.05);
		color: var(--text);
	}

	.device-item.selected {
		color: var(--text);
	}

	.device-item input[type='radio'] {
		display: none;
	}

	.radio-dot {
		width: 14px;
		height: 14px;
		min-width: 14px;
		border-radius: 50%;
		border: 2px solid var(--text-muted);
		position: relative;
		transition: all 0.2s ease;
	}

	.radio-dot::after {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%) scale(0);
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background-color: var(--success);
		transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.device-item.selected .radio-dot {
		border-color: var(--success);
	}

	.device-item.selected .radio-dot::after {
		transform: translate(-50%, -50%) scale(1);
	}

	.device-label {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		flex: 1;
	}

	.device-empty {
		padding: 12px 10px;
		color: var(--text-muted);
		font-size: 0.78rem;
		text-align: center;
		opacity: 0.6;
	}

	.popup-divider {
		height: 1px;
		background: rgba(255, 255, 255, 0.05);
		margin: 6px 0;
	}

	.input-meter-section,
	.threshold-section {
		padding: 4px 8px;
	}

	.meter-label {
		font-size: 0.68rem;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		margin-bottom: 5px;
	}

	.level-meter {
		position: relative;
		width: 100%;
		height: 6px;
		background: rgba(255, 255, 255, 0.06);
		border-radius: 3px;
		overflow: visible;
	}

	.level-fill {
		height: 100%;
		background: var(--success);
		border-radius: 3px;
		transition: width 0.06s linear;
		min-width: 0;
	}

	.level-fill.hot {
		background: var(--error);
	}

	.threshold-marker {
		position: absolute;
		top: -2px;
		width: 2px;
		height: 10px;
		background: var(--text);
		border-radius: 1px;
		opacity: 0.6;
		pointer-events: none;
	}

	.threshold-slider {
		-webkit-appearance: none;
		appearance: none;
		width: 100%;
		height: 4px;
		background: rgba(255, 255, 255, 0.08);
		border-radius: 2px;
		outline: none;
		cursor: pointer;
	}

	.threshold-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 14px;
		height: 14px;
		background: var(--text);
		border-radius: 50%;
		cursor: pointer;
		transition: transform 0.12s ease;
	}

	.threshold-slider::-webkit-slider-thumb:hover {
		transform: scale(1.2);
	}

	.threshold-slider::-moz-range-thumb {
		width: 14px;
		height: 14px;
		background: var(--text);
		border-radius: 50%;
		border: none;
		cursor: pointer;
	}

	.toggle-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 6px 8px;
		cursor: pointer;
		border-radius: 6px;
		transition: background 0.12s ease;
	}

	.toggle-row:hover {
		background: rgba(255, 255, 255, 0.04);
	}

	.toggle-label {
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.toggle-switch {
		width: 36px;
		height: 20px;
		background: rgba(255, 255, 255, 0.12);
		border-radius: 10px;
		position: relative;
		transition: background 0.2s ease;
		flex-shrink: 0;
	}

	.toggle-switch.on {
		background: var(--success);
	}

	.toggle-knob {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 16px;
		height: 16px;
		background: var(--text);
		border-radius: 50%;
		transition: left 0.2s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.toggle-switch.on .toggle-knob {
		left: 18px;
	}

	.popup-enter-active {
		transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.popup-leave-active {
		transition: all 0.12s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.popup-enter-from {
		opacity: 0;
		transform: translateY(4px) scale(0.95);
	}

	.popup-leave-to {
		opacity: 0;
		transform: translateY(4px) scale(0.95);
	}
</style>
