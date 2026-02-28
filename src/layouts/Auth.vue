<script setup lang="ts">
	import { onMounted, onUnmounted, ref } from 'vue';

	const canvasRef = ref<HTMLCanvasElement | null>(null);
	let animationFrameId: number;
	let resizeHandler: () => void;

	onMounted(() => {
		const canvas = canvasRef.value;
		if (!canvas) return;

		const ctx = canvas.getContext('2d')!;

		let width = window.innerWidth;
		let height = window.innerHeight;

		canvas.width = width;
		canvas.height = height;

		const getCssVar = (name: string, fallback: string) => {
			const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
			return val || fallback;
		};

		const toHsla = (color: string, alpha: number) => {
			if (color.startsWith('hsl')) {
				let inner = color.match(/\(([^)]+)\)/)?.[1] || '';
				const parts = inner.split(',').map((p) => p.trim());
				if (parts.length >= 3) {
					return `hsla(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
				}
			} else if (color.startsWith('rgb')) {
				let inner = color.match(/\(([^)]+)\)/)?.[1] || '';
				const parts = inner.split(',').map((p) => p.trim());
				if (parts.length >= 3) {
					return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
				}
			} else if (color.startsWith('#')) {
				let c = color.substring(1);
				if (c.length === 3)
					c = c
						.split('')
						.map((x) => x + x)
						.join('');
				let r = parseInt(c.slice(0, 2), 16),
					g = parseInt(c.slice(2, 4), 16),
					b = parseInt(c.slice(4, 6), 16);
				return `rgba(${r}, ${g}, ${b}, ${alpha})`;
			}
			return color;
		};

		resizeHandler = () => {
			width = window.innerWidth;
			height = window.innerHeight;
			canvas.width = width;
			canvas.height = height;
			initElements();
		};

		window.addEventListener('resize', resizeHandler);

		let blobs: Array<{ x: number; y: number; vx: number; vy: number; rx: number; ry: number; color: string; colorEnd: string }> =
			[];
		let stars: Array<{
			x: number;
			y: number;
			size: number;
			opacity: number;
			speedOpacity: number;
			vx: number;
			vy: number;
			type: 'circle' | 'cross';
		}> = [];

		let bgDarker = '';
		let bgDark = '';
		let colorBase = '';
		let colorDark = '';
		let colorLight = '';

		const initElements = () => {
			bgDarker = getCssVar('--bg-darker', '#04020a');
			bgDark = getCssVar('--bg-dark', '#0a0518');
			colorBase = getCssVar('--color', 'hsl(261, 68%, 45%)');
			colorDark = getCssVar('--color-dark', 'hsl(261, 68%, 40%)');
			colorLight = getCssVar('--color-light', 'hsl(261, 68%, 50%)');

			blobs = [
				{
					x: width * 0.2,
					y: height,
					vx: 0.1,
					vy: -0.05,
					rx: width * 0.6,
					ry: height * 0.6,
					color: toHsla(colorBase, 0.5),
					colorEnd: toHsla(colorBase, 0),
				},
				{
					x: width * 0.8,
					y: height,
					vx: -0.15,
					vy: -0.02,
					rx: width * 0.6,
					ry: height * 0.7,
					color: toHsla(colorDark, 0.6),
					colorEnd: toHsla(colorDark, 0),
				},
				{
					x: width * 0.5,
					y: height * 1.1,
					vx: 0.05,
					vy: 0.05,
					rx: width * 0.8,
					ry: height * 0.8,
					color: toHsla(colorLight, 0.7),
					colorEnd: toHsla(colorLight, 0),
				},
				{
					x: width * 0.5,
					y: height * 0.2,
					vx: -0.05,
					vy: 0.05,
					rx: width * 0.4,
					ry: height * 0.4,
					color: toHsla(colorDark, 0.1),
					colorEnd: toHsla(colorDark, 0),
				},
			];

			stars = [];
			const numStars = Math.floor((width * height) / 10000);
			for (let i = 0; i < numStars; i++) {
				stars.push({
					x: Math.random() * width,
					y: Math.random() * height * 0.9,
					size: Math.random() * 1.3 + 0.3,
					opacity: Math.random(),
					speedOpacity: (Math.random() * 0.015 + 0.005) * (Math.random() > 0.5 ? 1 : -1),
					vx: (Math.random() - 0.5) * 0.15,
					vy: (Math.random() - 0.5) * 0.15,
					type: Math.random() > 0.9 ? 'cross' : 'circle',
				});
			}
		};

		initElements();

		function draw() {
			const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
			bgGradient.addColorStop(0, '#000000');
			bgGradient.addColorStop(0.5, bgDarker);
			bgGradient.addColorStop(1, toHsla(colorDark, 0.2));

			ctx.fillStyle = bgGradient;
			ctx.fillRect(0, 0, width, height);

			stars.forEach((star) => {
				star.opacity += star.speedOpacity;
				if (star.opacity > 1) {
					star.opacity = 1;
					star.speedOpacity *= -1;
				} else if (star.opacity < 0.1) {
					star.opacity = 0.1;
					star.speedOpacity *= -1;
				}

				star.x += star.vx;
				star.y += star.vy;

				if (star.x < 0) star.x = width;
				if (star.x > width) star.x = 0;
				if (star.y < 0) star.y = height;
				if (star.y > height) star.y = 0;

				if (star.type === 'cross') {
					ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity * 0.6})`;
					ctx.beginPath();
					const thick = star.size * 0.4;
					const len = star.size * 3;
					ctx.rect(star.x - len, star.y - thick, len * 2, thick * 2);
					ctx.rect(star.x - thick, star.y - len, thick * 2, len * 2);
					ctx.fill();
				} else {
					ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity * 0.8})`;
					ctx.beginPath();
					ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
					ctx.fill();
				}
			});

			blobs.forEach((blob) => {
				blob.x += blob.vx;
				blob.y += blob.vy;

				if (blob.x <= -blob.rx || blob.x >= width + blob.rx) blob.vx *= -1;
				if (blob.y <= -blob.ry || blob.y >= height + blob.ry) blob.vy *= -1;

				ctx.save();
				ctx.translate(blob.x, blob.y);
				ctx.scale(blob.rx / blob.ry, 1);

				const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, blob.ry);
				gradient.addColorStop(0, blob.color);
				gradient.addColorStop(1, blob.colorEnd);

				ctx.fillStyle = gradient;
				ctx.beginPath();
				ctx.arc(0, 0, blob.ry, 0, Math.PI * 2);
				ctx.fill();
				ctx.restore();
			});

			animationFrameId = requestAnimationFrame(draw);
		}

		draw();
	});

	onUnmounted(() => {
		if (animationFrameId) cancelAnimationFrame(animationFrameId);
		if (resizeHandler) window.removeEventListener('resize', resizeHandler);
	});
</script>

<template>
	<div class="auth-layout">
		<canvas ref="canvasRef" class="bg-canvas"></canvas>
		<div class="card">
			<h2>ThisCrow</h2>
			<div class="buttons">
				<router-link to="/login">Login</router-link>
				<router-link to="/register">Register</router-link>
			</div>
			<router-view v-slot="{ Component }">
				<transition name="fade" mode="out-in">
					<component :is="Component" />
				</transition>
			</router-view>
		</div>
	</div>
</template>

<style scoped>
	.auth-layout {
		position: relative;
		height: 100vh;
		display: flex;
		justify-content: center;
		align-items: center;
		color: white;
		overflow: hidden;
	}
	h2 {
		padding-bottom: 24px;
		color: var(--text);
		font-weight: 700;
	}

	.bg-canvas {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		z-index: 0;
		pointer-events: none;
	}

	.card {
		background: var(--bg-dark);
		padding: 40px;
		border-radius: 8px;
		width: 440px;
		box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
		text-align: center;
		z-index: 1;
	}

	.buttons {
		display: flex;
		justify-content: center;
		margin-bottom: 8px;
		background: var(--bg-darker);
		padding: 5px;
		border-radius: 6px;
		gap: 5px;
	}

	.buttons a {
		flex: 1;
		margin: 0;
		padding: 10px 5px;
		border: none;
		background: transparent;
		cursor: pointer;
		font-weight: 600;
		border-radius: 4px;
		transition:
			background-color 0.2s,
			color 0.2s;
		color: #b5bac1;
		font-size: 0.95rem;
		text-decoration: none;
	}

	.buttons a.router-link-exact-active {
		background: var(--color);
		color: var(--text);
	}

	.buttons a:hover:not(.router-link-exact-active) {
		background: rgba(255, 255, 255, 0.05);
		color: var(--text-muted);
	}

	.fade-enter-active,
	.fade-leave-active {
		transition:
			opacity 0.3s ease,
			transform 0.3s ease;
	}
	.fade-enter-from,
	.fade-leave-to {
		opacity: 0;
		transform: translateY(10px);
	}
</style>
