<script setup lang="ts">
	import { ref, onMounted, onUnmounted } from 'vue';
	import { Icon } from '@iconify/vue';

	const messages = [
		{ sender: 'mira', receiver: 'aziz', text: 'hey, are we meeting tonight?' },
		{ sender: 'aziz', receiver: 'selin', text: 'secret plan for everyone: surprise party 🎉' },
		{ sender: 'selin', receiver: 'mira', text: "don't share the password with anyone!" },
		{ sender: 'mira', receiver: 'aziz', text: 'have you heard the new track? 🎵' },
	];

	const phase = ref<'typing' | 'encrypting' | 'transit' | 'decrypting' | 'received'>('typing');
	const msgIndex = ref(0);
	const currentMsg = ref(messages[0]);
	const cipherText = ref('');
	const displayText = ref('');
	const typedLength = ref(0);

	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
	const randomCipher = (len: number) =>
		Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

	let timer: ReturnType<typeof setTimeout>;
	let tickTimer: ReturnType<typeof setInterval>;

	const scrambleInterval = ref<ReturnType<typeof setInterval>>();

	const runCycle = () => {
		currentMsg.value = messages[msgIndex.value];
		const msg = currentMsg.value.text;

		// Phase 1: typing
		phase.value = 'typing';
		typedLength.value = 0;
		displayText.value = '';
		cipherText.value = '';

		let typeIdx = 0;
		tickTimer = setInterval(() => {
			typeIdx++;
			typedLength.value = typeIdx;
			displayText.value = msg.slice(0, typeIdx);
			if (typeIdx >= msg.length) {
				clearInterval(tickTimer);
				timer = setTimeout(startEncrypting, 600);
			}
		}, 50);
	};

	const startEncrypting = () => {
		phase.value = 'encrypting';
		const msg = currentMsg.value.text;
		let encIdx = 0;

		scrambleInterval.value = setInterval(() => {
			cipherText.value = randomCipher(msg.length);
		}, 60);

		tickTimer = setInterval(() => {
			encIdx++;
			if (encIdx >= msg.length) {
				clearInterval(tickTimer);
				timer = setTimeout(() => {
					if (scrambleInterval.value) clearInterval(scrambleInterval.value);
					cipherText.value = randomCipher(msg.length);
					startTransit();
				}, 400);
			}
		}, 30);
	};

	const startTransit = () => {
		phase.value = 'transit';

		scrambleInterval.value = setInterval(() => {
			cipherText.value = randomCipher(currentMsg.value.text.length);
		}, 80);

		timer = setTimeout(() => {
			if (scrambleInterval.value) clearInterval(scrambleInterval.value);
			startDecrypting();
		}, 1500);
	};

	const startDecrypting = () => {
		phase.value = 'decrypting';
		const msg = currentMsg.value.text;
		let decIdx = 0;

		tickTimer = setInterval(() => {
			decIdx++;
			const decrypted = msg.slice(0, decIdx);
			const remaining = randomCipher(Math.max(0, msg.length - decIdx));
			displayText.value = decrypted + remaining;
			if (decIdx >= msg.length) {
				clearInterval(tickTimer);
				displayText.value = msg;
				timer = setTimeout(() => {
					phase.value = 'received';
					timer = setTimeout(() => {
						msgIndex.value = (msgIndex.value + 1) % messages.length;
						runCycle();
					}, 2000);
				}, 400);
			}
		}, 40);
	};

	onMounted(() => {
		runCycle();
	});

	onUnmounted(() => {
		clearTimeout(timer);
		clearInterval(tickTimer);
		if (scrambleInterval.value) clearInterval(scrambleInterval.value);
	});
</script>

<template>
	<div class="e2e-mock">
		<!-- Sender side -->
		<div class="endpoint sender">
			<div class="device">
				<Icon icon="mdi:cellphone" class="device-icon" />
				<span class="device-label">{{ currentMsg.sender }}</span>
			</div>
			<div class="message-bubble outgoing" :class="{ active: phase === 'typing' || phase === 'encrypting' }">
				<span class="msg-text" v-if="phase === 'typing'">{{ displayText }}<span class="cursor-blink">|</span></span>
				<span class="msg-text cipher" v-else-if="phase === 'encrypting'">{{ cipherText || displayText }}</span>
				<span class="msg-text cipher" v-else>{{ cipherText || randomCipher(currentMsg.text.length) }}</span>
			</div>
		</div>

		<!-- Encryption tunnel -->
		<div class="tunnel">
			<div class="tunnel-track">
				<div class="particle-stream" :class="{ active: phase === 'transit' }">
					<span class="particle" v-for="i in 6" :key="i" :style="{ animationDelay: `${i * 0.18}s` }"></span>
				</div>
				<div class="tunnel-line"></div>
			</div>

			<div class="shield-badge" :class="{ glow: phase === 'transit' }">
				<Icon icon="mdi:shield-lock" class="shield-icon" />
			</div>

			<div class="tunnel-track">
				<div class="particle-stream right" :class="{ active: phase === 'transit' }">
					<span class="particle" v-for="i in 6" :key="i" :style="{ animationDelay: `${i * 0.18}s` }"></span>
				</div>
				<div class="tunnel-line"></div>
			</div>
		</div>

		<!-- Receiver side -->
		<div class="endpoint receiver">
			<div class="device">
				<Icon icon="mdi:laptop" class="device-icon" />
				<span class="device-label">{{ currentMsg.receiver }}</span>
			</div>
			<div class="message-bubble incoming" :class="{ active: phase === 'decrypting' || phase === 'received' }">
				<template v-if="phase === 'decrypting'">
					<span class="msg-text decrypting">{{ displayText }}</span>
				</template>
				<template v-else-if="phase === 'received'">
					<span class="msg-text received">{{ currentMsg.text }}</span>
				</template>
				<template v-else>
					<span class="msg-text waiting">
						<span class="dot-loader"><span></span><span></span><span></span></span>
					</span>
				</template>
			</div>
		</div>

		<!-- Status bar -->
		<div class="status-bar">
			<div class="status-dot" :class="phase"></div>
			<span class="status-text">
				<template v-if="phase === 'typing'">Composing message...</template>
				<template v-else-if="phase === 'encrypting'">Encrypting end-to-end...</template>
				<template v-else-if="phase === 'transit'">Encrypted transfer...</template>
				<template v-else-if="phase === 'decrypting'">Decrypting...</template>
				<template v-else>Delivered ✓</template>
			</span>
		</div>
	</div>
</template>

<style scoped>
	.e2e-mock {
		width: clamp(340px, 95cqw, 500px);
		background: var(--bg-darker);
		padding: 28px 24px 20px;
		display: flex;
		flex-direction: column;
		gap: 18px;
		text-align: center;
		overflow: hidden;
	}

	/* Endpoints */
	.endpoint {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
	}

	.device {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--text-secondary);
		font-size: 0.8rem;
		font-weight: 600;
	}

	.device-icon {
		font-size: 1.3rem;
		color: var(--text-muted);
	}

	.device-label {
		text-transform: capitalize;
	}

	/* Message bubbles */
	.message-bubble {
		background: var(--bg-dark);
		border: 1px solid hsla(0, 0%, 100%, 0.06);
		border-radius: 12px;
		padding: 10px 16px;
		min-height: 40px;
		min-width: 200px;
		max-width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		transition:
			border-color 0.3s ease,
			box-shadow 0.3s ease;
	}

	.message-bubble.active {
		border-color: hsla(145, 60%, 45%, 0.3);
		box-shadow: 0 0 20px hsla(145, 60%, 45%, 0.08);
	}

	.message-bubble.incoming.active {
		border-color: hsla(210, 70%, 55%, 0.3);
		box-shadow: 0 0 20px hsla(210, 70%, 55%, 0.08);
	}

	.msg-text {
		font-size: 0.85rem;
		color: var(--text);
		word-break: break-word;
		font-weight: 500;
	}

	.msg-text.cipher {
		font-family: 'Courier New', monospace;
		color: hsl(145, 60%, 55%);
		letter-spacing: 0.5px;
		font-size: 0.78rem;
	}

	.msg-text.decrypting {
		font-family: 'Courier New', monospace;
		color: hsl(210, 70%, 65%);
		letter-spacing: 0.3px;
		font-size: 0.82rem;
	}

	.msg-text.received {
		color: var(--text);
	}

	.cursor-blink {
		animation: blink 0.6s step-end infinite;
		color: var(--color-lighter);
		font-weight: 300;
	}

	@keyframes blink {
		50% {
			opacity: 0;
		}
	}

	/* Dot loader */
	.dot-loader {
		display: inline-flex;
		gap: 4px;
	}

	.dot-loader span {
		width: 6px;
		height: 6px;
		background: var(--text-muted);
		border-radius: 50%;
		animation: dotPulse 1.2s ease-in-out infinite;
	}

	.dot-loader span:nth-child(2) {
		animation-delay: 0.15s;
	}

	.dot-loader span:nth-child(3) {
		animation-delay: 0.3s;
	}

	@keyframes dotPulse {
		0%,
		80%,
		100% {
			opacity: 0.3;
			transform: scale(0.8);
		}
		40% {
			opacity: 1;
			transform: scale(1);
		}
	}

	/* Tunnel */
	.tunnel {
		display: flex;
		align-items: center;
		gap: 0;
		padding: 8px 0;
	}

	.tunnel-track {
		flex: 1;
		height: 2px;
		position: relative;
	}

	.tunnel-line {
		position: absolute;
		inset: 0;
		background: linear-gradient(90deg, hsla(145, 60%, 45%, 0.15), hsla(145, 60%, 45%, 0.3), hsla(145, 60%, 45%, 0.15));
		border-radius: 1px;
	}

	/* Particles */
	.particle-stream {
		position: absolute;
		inset: 0;
		overflow: hidden;
		opacity: 0;
		transition: opacity 0.3s ease;
	}

	.particle-stream.active {
		opacity: 1;
	}

	.particle {
		position: absolute;
		width: 6px;
		height: 6px;
		background: hsl(145, 70%, 55%);
		border-radius: 50%;
		top: 50%;
		transform: translateY(-50%);
		box-shadow: 0 0 8px hsl(145, 70%, 55%);
		animation: particleMove 1.2s linear infinite;
	}

	.particle-stream.right .particle {
		animation: particleMoveRight 1.2s linear infinite;
	}

	@keyframes particleMove {
		0% {
			left: -6px;
			opacity: 0;
		}
		10% {
			opacity: 1;
		}
		90% {
			opacity: 1;
		}
		100% {
			left: calc(100% + 6px);
			opacity: 0;
		}
	}

	@keyframes particleMoveRight {
		0% {
			left: -6px;
			opacity: 0;
		}
		10% {
			opacity: 1;
		}
		90% {
			opacity: 1;
		}
		100% {
			left: calc(100% + 6px);
			opacity: 0;
		}
	}

	/* Shield */
	.shield-badge {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: hsla(145, 50%, 20%, 0.4);
		border: 2px solid hsla(145, 60%, 45%, 0.3);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition:
			box-shadow 0.4s ease,
			border-color 0.4s ease,
			background 0.4s ease;
	}

	.shield-badge.glow {
		border-color: hsl(145, 60%, 50%);
		box-shadow:
			0 0 24px hsla(145, 70%, 50%, 0.35),
			0 0 60px hsla(145, 70%, 50%, 0.12);
		background: hsla(145, 50%, 25%, 0.5);
	}

	.shield-icon {
		font-size: 1.4rem;
		color: hsl(145, 60%, 55%);
	}

	/* Status bar */
	.status-bar {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding-top: 4px;
	}

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--text-muted);
		transition: background 0.3s ease;
	}

	.status-dot.typing {
		background: var(--text-secondary);
	}

	.status-dot.encrypting {
		background: hsl(145, 60%, 50%);
		animation: pulse 0.8s ease-in-out infinite;
	}

	.status-dot.transit {
		background: hsl(145, 70%, 55%);
		animation: pulse 0.6s ease-in-out infinite;
	}

	.status-dot.decrypting {
		background: hsl(210, 70%, 55%);
		animation: pulse 0.8s ease-in-out infinite;
	}

	.status-dot.received {
		background: hsl(145, 60%, 50%);
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.5;
			transform: scale(0.8);
		}
	}

	.status-text {
		font-size: 0.75rem;
		color: var(--text-muted);
		font-weight: 600;
	}
</style>
