<script setup lang="ts">
	import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
	import { Icon } from '@iconify/vue';
	import { categories } from '@/utils/emoji';

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
	const gridRef = ref<HTMLElement | null>(null);
	const sectionRefs = ref<HTMLElement[]>([]);

	const filteredEmojis = computed(() => {
		const q = search.value.trim().toLowerCase();
		if (!q) return [];
		const all = categories.flatMap((c) => c.emojis);
		return all.filter((e) => {
			try {
				const code = [...e].map((ch) => ch.codePointAt(0)?.toString(16)).join('-');
				return code.includes(q);
			} catch {
				return false;
			}
		});
	});

	function selectEmoji(e: string) {
		emit('select', e);
	}

	function scrollToCategory(index: number) {
		activeCategory.value = index;
		const section = sectionRefs.value[index];
		const grid = gridRef.value;
		if (section && grid) {
			grid.scrollTo({ top: section.offsetTop - grid.offsetTop, behavior: 'smooth' });
		}
	}

	function onGridScroll() {
		if (search.value) return;
		const grid = gridRef.value;
		if (!grid) return;
		const scrollTop = grid.scrollTop;
		let active = 0;
		for (let i = 0; i < sectionRefs.value.length; i++) {
			const el = sectionRefs.value[i];
			if (!el) continue;
			if (el.offsetTop - grid.offsetTop - 12 <= scrollTop) {
				active = i;
			}
		}
		activeCategory.value = active;
	}

	const pickerStyle = computed(() => {
		if (!props.anchor) return {};
		const rect = props.anchor.getBoundingClientRect();
		const pickerW = 380;
		const pickerH = 520;
		let left = rect.right - pickerW;
		let top = rect.top - pickerH - 8;
		if (left < 8) left = 8;
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
		nextTick(onGridScroll);
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

				<div class="ep-grid" ref="gridRef" @scroll="onGridScroll">
					<template v-if="search">
						<div class="ep-section-header">
							<span>Search Results</span>
						</div>
						<div v-if="filteredEmojis.length === 0" class="ep-empty">
							<Icon icon="mdi:emoticon-sad-outline" class="ep-empty-icon" />
							<span>No emoji found</span>
						</div>
						<div v-else class="ep-row">
							<button v-for="emoji in filteredEmojis" :key="emoji" class="ep-emoji" @click="selectEmoji(emoji)">{{ emoji }}</button>
						</div>
					</template>

					<template v-else>
						<template v-for="(cat, i) in categories" :key="i">
							<div
								class="ep-section"
								:ref="
									(el) => {
										if (el) sectionRefs[i] = el as HTMLElement;
									}
								"
							>
								<div class="ep-section-header">
									<span>{{ cat.label }}</span>
								</div>
								<div class="ep-row">
									<button v-for="emoji in cat.emojis" :key="emoji" class="ep-emoji" @click="selectEmoji(emoji)">{{ emoji }}</button>
								</div>
							</div>
						</template>
					</template>
				</div>
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

	.ep-grid {
		flex: 1;
		overflow-y: auto;
		padding: 0 8px 8px;
		scrollbar-width: thin;
		scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
	}

	.ep-grid::-webkit-scrollbar {
		width: 6px;
	}

	.ep-grid::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.1);
		border-radius: 3px;
	}

	.ep-grid::-webkit-scrollbar-thumb:hover {
		background: rgba(255, 255, 255, 0.15);
	}

	.ep-grid::-webkit-scrollbar-track {
		background: transparent;
	}

	.ep-section {
		scroll-margin-top: 8px;
	}

	.ep-section-header {
		position: sticky;
		top: 0;
		display: flex;
		align-items: center;
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
		padding: 8px 4px 6px;
		background: linear-gradient(180deg, var(--bg-darker) 0%, var(--bg-darker) 70%, transparent 100%);
		z-index: 1;
	}

	.ep-row {
		display: grid;
		grid-template-columns: repeat(8, 1fr);
		gap: 2px;
	}

	.ep-emoji {
		background: none;
		border: none;
		font-size: 1.4rem;
		line-height: 1;
		aspect-ratio: 1;
		width: 100%;
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
