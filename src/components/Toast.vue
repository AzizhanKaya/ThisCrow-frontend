<script setup lang="ts">
	import { ref, onMounted } from 'vue';
	import { Icon } from '@iconify/vue';
	import gsap from 'gsap';

	const props = defineProps<{
		message: string;
		duration?: number;
	}>();

	const visible = ref(true);
	const toastRef = ref(null);

	const onEnter = (el: Element, done: () => void) => {
		gsap.fromTo(
			el,
			{
				y: -100,
				x: '-50%',
				opacity: 0,
			},
			{
				y: 80,
				opacity: 1,
				duration: 0.8,
				ease: 'bounce.out',
				onComplete: () => {
					gsap.to(el, {
						x: '+=10',
						repeat: 7,
						yoyo: true,
						duration: 0.04,
						onComplete: () => {
							gsap.set(el, { x: '-50%' });
							done();
						},
					});
				},
			}
		);
	};

	const onLeave = (el: Element, done: () => void) => {
		gsap.to(el, {
			y: -50,
			opacity: 0,
			duration: 0.4,
			ease: 'power2.in',
			onComplete: done,
		});
	};

	onMounted(() => {
		setTimeout(() => {
			visible.value = false;
		}, props.duration || 3000);
	});
</script>

<template>
	<transition :css="false" @enter="onEnter" @leave="onLeave">
		<div v-if="visible" ref="toastRef" class="toast">
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
		transform: translateX(-50%);
		background: var(--error);
		color: white;
		padding: 0.8rem 1.2rem;
		border-radius: 12px;
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2);
		z-index: 1000;
		font-weight: 500;
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 200px;
	}

	.icon {
		font-size: 24px;
		flex-shrink: 0;
	}
</style>
