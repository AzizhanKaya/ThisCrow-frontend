<script setup lang="ts">
	import { ref, onMounted, onUnmounted } from 'vue';
	import { Icon } from '@iconify/vue';
	import gsap from 'gsap';

	const props = defineProps<{
		message: string;
		duration?: number;
	}>();
	const emit = defineEmits(['close']);

	const visible = ref(true);
	let timeoutId: ReturnType<typeof setTimeout>;

	const onEnter = (el: Element, done: () => void) => {
		gsap.set(el, { y: -100, xPercent: -50, x: 0, opacity: 0 });

		const tl = gsap.timeline({ onComplete: done });

		tl
			.to(el, {
				y: 40,
				opacity: 1,
				duration: 0.5,
				ease: 'back.out(1.5)',
			})
			.to(el, {
				keyframes: {
					x: [0, -8, 8, -6, 6, -4, 4, -2, 2, 0],
				},
				duration: 0.4,
				ease: 'power1.inOut',
			});
	};

	const onLeave = (el: Element, done: () => void) => {
		gsap.to(el, {
			y: -50,
			opacity: 0,
			duration: 0.3,
			ease: 'power2.in',
			onComplete: () => {
				done();
				emit('close');
			},
		});
	};

	onMounted(() => {
		timeoutId = setTimeout(() => {
			visible.value = false;
		}, props.duration || 1500);
	});

	onUnmounted(() => {
		if (timeoutId) clearTimeout(timeoutId);
	});
</script>

<template>
	<transition appear :css="false" @appear="onEnter" @enter="onEnter" @leave="onLeave">
		<div v-if="visible" class="toast">
			<Icon icon="mdi:close-circle" class="icon" />
			<span>{{ message }}</span>
		</div>
	</transition>
</template>

<style scoped>
	.toast {
		position: fixed;
		top: 0;
		left: 50%;
		background: var(--error);
		color: white;
		padding: 0.8rem 1.2rem;
		border-radius: 12px;
		box-shadow:
			0 10px 15px -3px rgba(0, 0, 0, 0.2),
			0 4px 6px -2px rgba(0, 0, 0, 0.1);
		z-index: 1000;
		font-weight: 500;
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 250px;
	}

	.icon {
		font-size: 24px;
		flex-shrink: 0;
	}
</style>
