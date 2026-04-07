<script setup lang="ts">
	import { Icon } from '@iconify/vue';
	import { ref, watch, nextTick, onUnmounted } from 'vue';

	export type ContextMenuOption = {
		label?: string;
		action?: string;
		icon?: string;
		variant?: 'danger' | 'success';
		divider?: boolean;
		subtext?: string;
		rightIcon?: string;
		rightText?: string;
		children?: ContextMenuOption[];
		checked?: boolean;
		stayOpen?: boolean;
		data?: any;
	};

	const props = defineProps<{
		show: boolean;
		x: number;
		y: number;
		options: ContextMenuOption[];
		minWidth?: number;
	}>();

	const emit = defineEmits<{
		(e: 'select', action: string, option: ContextMenuOption): void;
		(e: 'close'): void;
	}>();

	const menuRef = ref<HTMLElement | null>(null);
	const activeSubmenu = ref<number | null>(null);

	const handleClickOutside = () => {
		emit('close');
	};

	const handleContextOutside = (event: MouseEvent) => {
		if (menuRef.value && !menuRef.value.contains(event.target as Node)) {
			emit('close');
		}
	};

	watch(
		() => props.show,
		async (newVal) => {
			if (newVal) {
				await nextTick();

				requestAnimationFrame(() => {
					document.addEventListener('click', handleClickOutside);
					document.addEventListener('contextmenu', handleContextOutside);
				});

				if (menuRef.value) {
					const width = menuRef.value.offsetWidth;
					const height = menuRef.value.offsetHeight;
					const maxX = window.innerWidth - width;
					const maxY = window.innerHeight - height;

					let finalX = props.x;
					let finalY = props.y;

					if (finalX > maxX) finalX = maxX - 5;
					if (finalY > maxY) finalY = maxY - 5;

					menuRef.value.style.left = `${finalX}px`;
					menuRef.value.style.top = `${finalY}px`;
				}
			} else {
				document.removeEventListener('click', handleClickOutside);
				document.removeEventListener('contextmenu', handleContextOutside);
			}
		},
		{ immediate: true }
	);

	onUnmounted(() => {
		document.removeEventListener('click', handleClickOutside);
		document.removeEventListener('contextmenu', handleContextOutside);
	});
</script>

<template>
	<Transition name="context-menu">
		<div v-if="show" ref="menuRef" class="context-menu" @click.stop @contextmenu.prevent>
			<template v-for="(option, index) in options" :key="option.action || index">
				<div v-if="option.divider" class="menu-divider"></div>
				<div
					v-else
					class="menu-item-wrapper"
					@mouseenter="activeSubmenu = index"
					@mouseleave="activeSubmenu = null"
				>
					<button
						class="menu-item"
						:class="option.variant"
						@click="
							if (option.action) {
								emit('select', option.action, option);
								if (!option.stayOpen) emit('close');
							}
						"
					>
						<div class="item-left">
							<div v-if="option.checked !== undefined" class="check-box">
								<Icon v-if="option.checked" icon="mdi:check" class="check-icon" />
							</div>
							<Icon v-if="option.icon" :icon="option.icon" class="item-icon" />
							<div class="item-text">
								<span class="label">{{ option.label }}</span>
								<span v-if="option.subtext" class="subtext">{{ option.subtext }}</span>
							</div>
						</div>
						<div class="item-right" v-if="option.rightIcon || option.rightText || option.children">
							<Icon v-if="option.rightIcon" :icon="option.rightIcon" class="right-icon" />
							<span v-if="option.rightText" class="right-badge">{{ option.rightText }}</span>
							<Icon v-if="option.children" icon="mdi:chevron-right" class="right-icon" />
						</div>
					</button>
					
					<!-- Nested Menu -->
					<div v-if="option.children && activeSubmenu === index" class="submenu-container">
						<div class="context-menu nested-menu">
							<template v-for="(child, childIndex) in option.children" :key="child.action || childIndex">
								<div v-if="child.divider" class="menu-divider"></div>
								<button
									v-else
									class="menu-item"
									:class="child.variant"
									@click="
										if (child.action) {
											emit('select', child.action, child);
											if (!child.stayOpen) emit('close');
										}
									"
								>
									<div class="item-left">
										<div v-if="child.checked !== undefined" class="check-box">
											<Icon v-if="child.checked" icon="mdi:check" class="check-icon" />
										</div>
										<Icon v-if="child.icon" :icon="child.icon" class="item-icon" />
										<div class="item-text">
											<span class="label">{{ child.label }}</span>
											<span v-if="child.subtext" class="subtext">{{ child.subtext }}</span>
										</div>
									</div>
									<div class="item-right" v-if="child.rightIcon || child.rightText">
										<Icon v-if="child.rightIcon" :icon="child.rightIcon" class="right-icon" />
										<span v-if="child.rightText" class="right-badge">{{ child.rightText }}</span>
									</div>
								</button>
							</template>
						</div>
					</div>
				</div>
			</template>
		</div>
	</Transition>
</template>

<style scoped>
	.context-menu-enter-active,
	.context-menu-leave-active {
		transition:
			opacity 0.15s ease,
			transform 0.15s ease;
	}

	.context-menu-enter-from,
	.context-menu-leave-to {
		opacity: 0;
		transform: translateY(5px) scale(0.98);
	}

	.context-menu {
		position: fixed;
		z-index: 100;
		background-color: var(--bg-darker);
		border-radius: 8px;
		padding: 8px;
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: v-bind('minWidth + "px"');
		box-shadow: 0 8px 16px rgba(0, 0, 0, 0.24);
		pointer-events: auto;
	}

	.menu-divider {
		height: 1px;
		background-color: var(--border);
		margin: 4px 0;
	}

	.menu-item-wrapper {
		position: relative;
	}

	.submenu-container {
		position: absolute;
		left: 100%;
		top: -8px;
		padding-left: 6px;
		z-index: 101;
	}

	.nested-menu {
		position: static;
		min-width: 180px;
	}

	.menu-item {
		background: none;
		border: none;
		color: var(--text);
		padding: 8px;
		text-align: left;
		cursor: pointer;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-family: inherit;
		width: 100%;
		transition: none;
	}

	.item-left {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.item-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.label {
		font-size: 14px;
		font-weight: 500;
		color: var(--text-muted);
	}

	.subtext {
		font-size: 11px;
		font-weight: 400;
		color: var(--text-subtle);
	}

	.item-icon {
		font-size: 18px;
		flex-shrink: 0;
		color: var(--text);
	}

	.right-icon {
		font-size: 18px;
		color: var(--text);
	}

	.right-badge {
		background-color: var(--bg-light);
		color: var(--text-muted);
		font-size: 10px;
		font-weight: 700;
		padding: 2px 4px;
		border-radius: 4px;
		letter-spacing: 0.5px;
	}

	.menu-item:hover {
		background-color: var(--color);
	}

	.menu-item:hover .label,
	.menu-item:hover .subtext,
	.menu-item:hover .item-icon,
	.menu-item:hover .right-icon {
		color: var(--text);
	}

	.menu-item:hover .right-badge {
		background-color: var(--text);
		color: var(--color-dark);
	}

	.menu-item.danger .label,
	.menu-item.danger .item-icon {
		color: var(--error);
	}

	.menu-item.danger:hover {
		background-color: var(--error-hover);
	}

	.menu-item.danger:hover .label,
	.menu-item.danger:hover .item-icon {
		color: var(--text);
	}

	.menu-item.success .label,
	.menu-item.success .item-icon {
		color: var(--success);
	}

	.menu-item.success:hover {
		background-color: var(--success-hover);
	}

	.menu-item.success:hover .label,
	.menu-item.success:hover .item-icon {
		color: var(--text);
	}

	.check-box {
		width: 16px;
		height: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.check-icon {
		font-size: 16px;
		color: var(--text);
	}
</style>
