import { defineStore } from 'pinia';
import { ref, nextTick } from 'vue';
import type { ContextMenuOption } from '@/components/ContextMenu.vue';

export const useContextMenuStore = defineStore('contextMenu', () => {
	const show = ref(false);
	const x = ref(0);
	const y = ref(0);
	const target = ref<HTMLElement | undefined>(undefined);
	const options = ref<ContextMenuOption[]>([]);
	const submenuDirection = ref<'left' | 'right'>('right');
	const minWidth = ref<number>(180);
	const zIndex = ref<number>(200);
	const onSelect = ref<((action: string, option: ContextMenuOption) => void) | null>(null);

	async function open(params: {
		e: MouseEvent;
		options: ContextMenuOption[];
		x?: number;
		y?: number;
		submenuDirection?: 'left' | 'right';
		minWidth?: number;
		zIndex?: number;
		onSelect: (action: string, option: ContextMenuOption) => void;
	}) {
		if (show.value) {
			show.value = false;
			await nextTick();
		}

		x.value = params.x ?? params.e.clientX;
		y.value = params.y ?? params.e.clientY;
		target.value = params.e.currentTarget as HTMLElement;
		options.value = params.options;
		submenuDirection.value = params.submenuDirection || 'right';
		minWidth.value = params.minWidth || 180;
		zIndex.value = params.zIndex ?? 200;
		onSelect.value = params.onSelect;
		show.value = true;
	}

	function close() {
		show.value = false;
	}

	return { show, x, y, target, options, submenuDirection, minWidth, zIndex, onSelect, open, close };
});
