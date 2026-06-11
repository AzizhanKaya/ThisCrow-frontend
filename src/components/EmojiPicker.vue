<script setup lang="ts">
	import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
	import { Icon } from '@iconify/vue';
	import { categories } from '@/utils/emoji';
	import { RecycleScroller } from 'vue-virtual-scroller';
	import 'vue-virtual-scroller/dist/vue-virtual-scroller.css';

	const emit = defineEmits<{
		(e: 'select', emoji: string): void;
		(e: 'gif', url: string): void;
		(e: 'close'): void;
	}>();

	const props = defineProps<{
		anchor?: HTMLElement | null;
	}>();

	const search = ref('');
	const activeCategory = ref(0);
	const scrollerRef = ref<any>(null);

	const virtualItems = computed(() => {
		const items: Array<
			| { type: 'header'; id: string; label: string; categoryIndex: number }
			| { type: 'row'; id: string; emojis: string[]; categoryIndex: number }
		> = [];
		categories.forEach((cat, i) => {
			items.push({ type: 'header', id: `h-${i}`, label: cat.label, categoryIndex: i });
			for (let j = 0; j < cat.emojis.length; j += 8) {
				items.push({ type: 'row', id: `r-${i}-${j}`, emojis: cat.emojis.slice(j, j + 8), categoryIndex: i });
			}
		});
		return items;
	});

	const searchItems = computed(() => {
		const q = search.value.trim().toLowerCase();
		if (!q) return [];
		const filtered = categories
			.flatMap((c) => c.emojis)
			.filter((e) => {
				try {
					return [...e]
						.map((ch) => ch.codePointAt(0)?.toString(16))
						.join('-')
						.includes(q);
				} catch {
					return false;
				}
			});

		const items: Array<{ type: 'header'; id: string; label: string } | { type: 'row'; id: string; emojis: string[] }> = [
			{ type: 'header', id: 'search-header', label: 'Search Results' },
		];
		for (let j = 0; j < filtered.length; j += 8) {
			items.push({ type: 'row', id: `search-r-${j}`, emojis: filtered.slice(j, j + 8) });
		}
		return items;
	});

	function selectEmoji(e: string) {
		emit('select', e);
	}

	const isScrollingToCategory = ref(false);

	function scrollToCategory(index: number) {
		activeCategory.value = index;
		if (search.value) return;
		const itemIndex = virtualItems.value.findIndex((item) => item.type === 'header' && item.categoryIndex === index);
		if (itemIndex !== -1 && scrollerRef.value) {
			isScrollingToCategory.value = true;
			scrollerRef.value.scrollToItem(itemIndex);
			setTimeout(() => {
				isScrollingToCategory.value = false;
			}, 150);
		}
	}

	function onScrollUpdate(startIndex: number, endIndex: number, visibleStartIndex?: number) {
		if (search.value || isScrollingToCategory.value) return;
		const baseIndex = visibleStartIndex !== undefined ? visibleStartIndex : startIndex;
		const index = Math.min(baseIndex + 1, virtualItems.value.length - 1);
		const item = virtualItems.value[index];
		if (item && 'categoryIndex' in item) {
			activeCategory.value = item.categoryIndex;
		}
	}

	const pickerStyle = computed(() => {
		if (!props.anchor) return {};
		const rect = props.anchor.getBoundingClientRect();
		const pickerW = 380,
			pickerH = 440;
		let left = Math.max(8, Math.min(rect.right - pickerW, window.innerWidth - pickerW - 8));
		let top = rect.top - pickerH - 8;
		if (top < 8) top = Math.max(8, Math.min(rect.bottom + 8, window.innerHeight - pickerH - 8));
		return { position: 'fixed' as const, left: `${left}px`, top: `${top}px` };
	});

	const pickerRef = ref<HTMLElement | null>(null);

	function onOutsideClick(event: MouseEvent) {
		const target = event.target as Node;
		if (pickerRef.value && !pickerRef.value.contains(target) && props.anchor && !props.anchor.contains(target)) {
			emit('close');
		}
	}

	onMounted(() => {
		setTimeout(() => document.addEventListener('mousedown', onOutsideClick), 0);
	});

	onBeforeUnmount(() => {
		document.removeEventListener('mousedown', onOutsideClick);
	});
</script>

<template>
	<Teleport to="body">
		<div class="emoji-picker" ref="pickerRef" :style="pickerStyle">
			<div class="ep-sidebar">
				<button
					v-for="(cat, i) in categories"
					:key="i"
					class="ep-side-tab"
					:class="{ active: activeCategory === i && !search }"
					:title="cat.label"
					@click="scrollToCategory(i)"
				>
					<Icon :icon="cat.icon" />
				</button>
			</div>

			<div class="ep-main">
				<div class="ep-search-row">
					<Icon icon="mdi:magnify" class="ep-search-icon" />
					<input v-model="search" class="ep-search" placeholder="Find the perfect emoji" autofocus />
				</div>

				<div v-if="search && searchItems.length === 1" class="ep-empty">
					<Icon icon="mdi:emoticon-sad-outline" class="ep-empty-icon" />
					<span>No emoji found</span>
				</div>
				<RecycleScroller
					v-else
					ref="scrollerRef"
					class="ep-grid-scroller"
					:items="search ? searchItems : virtualItems"
					:item-size="40"
					key-field="id"
					emit-update
					@update="onScrollUpdate"
				>
					<template #default="{ item }">
						<div class="scroller-item">
							<div v-if="item.type === 'header'" class="ep-section-header">
								<span>{{ item.label }}</span>
							</div>
							<div v-else class="ep-row">
								<button v-for="emoji in item.emojis" :key="emoji" class="ep-emoji" @click="selectEmoji(emoji)">
									{{ emoji }}
								</button>
							</div>
						</div>
					</template>
				</RecycleScroller>
			</div>
		</div>
	</Teleport>
</template>

<style scoped>
	.emoji-picker {
		width: 380px;
		height: 440px;
		display: flex;
		background: linear-gradient(180deg, var(--bg-darker) 0%, var(--bg-darkest, #1a1a1f) 100%);
		border: 1px solid rgba(255, 255, 255, 0.07);
		border-radius: 10px;
		overflow: hidden;
		z-index: 500;
		box-shadow:
			0 12px 40px rgba(0, 0, 0, 0.55),
			0 4px 12px rgba(0, 0, 0, 0.3);
		user-select: none;
		font-family: Arial, Helvetica, sans-serif;
		animation: pop-in 0.14s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.emoji-picker button,
	.emoji-picker input {
		font-family: inherit;
	}

	@keyframes pop-in {
		from {
			opacity: 0;
			transform: translateY(4px) scale(0.96);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	.ep-sidebar {
		width: 48px;
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 8px 4px;
		background: rgba(0, 0, 0, 0.2);
		border-right: 1px solid rgba(255, 255, 255, 0.04);
		overflow-y: auto;
		scrollbar-width: none;
		flex-shrink: 0;
	}

	.ep-sidebar::-webkit-scrollbar {
		display: none;
	}

	.ep-side-tab {
		background: none;
		border: none;
		color: var(--text-muted);
		font-size: 1.15rem;
		width: 40px;
		height: 40px;
		border-radius: 8px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition:
			background 0.12s ease,
			color 0.12s ease;
		flex-shrink: 0;
	}

	.ep-side-tab:hover {
		background: rgba(255, 255, 255, 0.05);
		color: var(--text);
	}

	.ep-side-tab.active {
		background: rgba(255, 255, 255, 0.08);
		color: var(--text);
	}

	.ep-main {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.ep-search-row {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 10px 10px 8px;
		padding: 8px 12px;
		background: rgba(0, 0, 0, 0.25);
		border: 1px solid rgba(255, 255, 255, 0.04);
		border-radius: 8px;
		transition: border-color 0.12s ease;
	}

	.ep-search-row:focus-within {
		border-color: rgba(255, 255, 255, 0.15);
	}

	.ep-search-icon {
		color: var(--text-muted);
		font-size: 1rem;
		flex-shrink: 0;
	}

	.ep-search {
		flex: 1;
		background: none;
		border: none;
		outline: none;
		color: var(--text);
		font-size: 0.88rem;
		min-width: 0;
	}

	.ep-search::placeholder {
		color: var(--text-muted);
		opacity: 0.6;
	}

	.ep-grid-scroller {
		flex: 1;
		padding: 0 8px 8px;
		scrollbar-width: thin;
		scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
	}

	.ep-grid-scroller::-webkit-scrollbar {
		width: 6px;
	}

	.ep-grid-scroller::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.1);
		border-radius: 3px;
	}

	.ep-grid-scroller::-webkit-scrollbar-thumb:hover {
		background: rgba(255, 255, 255, 0.15);
	}

	.ep-grid-scroller::-webkit-scrollbar-track {
		background: transparent;
	}

	.scroller-item {
		height: 100%;
	}

	.ep-section-header {
		height: 40px;
		display: flex;
		align-items: center;
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
		padding: 0 4px;
	}

	.ep-row {
		height: 40px;
		display: grid;
		grid-template-columns: repeat(8, 1fr);
		gap: 2px;
	}

	.ep-emoji {
		background: none;
		border: none;
		font-size: 1.4rem;
		line-height: 1;
		height: 36px;
		width: 36px;
		margin: auto;
		border-radius: 6px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition:
			background 0.1s ease,
			transform 0.1s ease;
		padding: 0;
	}

	.ep-emoji:hover {
		background: rgba(255, 255, 255, 0.08);
		transform: scale(1.15);
	}

	.ep-emoji:active {
		transform: scale(0.95);
	}

	.ep-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 40px 16px;
		color: var(--text-muted);
		font-size: 0.85rem;
	}

	.ep-empty-icon {
		font-size: 2.4rem;
		opacity: 0.4;
	}
</style>
