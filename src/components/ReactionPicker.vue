<script setup lang="ts">
	import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
	import { Icon } from '@iconify/vue';

	const emit = defineEmits<{
		(e: 'select', emoji: string): void;
		(e: 'close'): void;
	}>();

	const props = defineProps<{
		anchor?: HTMLElement | null;
	}>();

	const search = ref('');

	const popular = [
		'👍','❤️','😂','🎉','🔥','😍','😢','😮','😡','🙏','👏','💯',
		'😊','🤔','😎','😴','🥳','😅','😭','🤣','😘','🤗','✨','⭐',
		'💀','👀','🙌','👌','💪','🤝','✅','❌','🚀','💖','🌟','⚡',
	];

	const allEmojis = [
		...popular,
		'😀','😁','😃','😄','😆','😉','😋','🥰','😗','😙','😚','🙂','🤩','🤨','😐','😑','😶','🙄','😏','😣','😥',
		'🤐','😯','😪','😫','🥱','😌','😛','😜','😝','🤤','😒','😓','😔','😕','🙃','🤑','😲','🙁','😖','😞','😟',
		'😤','😦','😧','😨','😩','🤯','😬','😰','😱','🥵','🥶','😳','🤪','😵','🥴','😠','🤬','😷','🤒','🤕','🤢',
		'🤮','🤧','😇','🥸','🤠','🤡','🤥','🤫','🤭','🧐','🤓','😈','👿','👻','🤖','👽','👾','🙈','🙉','🙊',
		'👋','🤚','🖐️','✋','🖖','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','👎','✊','👊','🤛',
		'🤜','👐','🤲','✍️','🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🦄','🐝',
		'🍎','🍕','🍔','🍟','🌮','🍩','🍪','🎂','🍰','🍭','🍫','🍿','🍺','🍻','🥂','🍷','🍸','🍹','☕','🥤','🎮',
		'🎯','🎲','🎸','🎵','🎶','💰','💸','💎','🏆','🎁','🎈','🎊','🏠','🚗','✈️','🚀',
	];

	const filteredEmojis = computed(() => {
		const q = search.value.trim().toLowerCase();
		if (!q) return popular;
		return allEmojis.filter((e) => {
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

	const pickerStyle = computed(() => {
		if (!props.anchor) return {};
		const rect = props.anchor.getBoundingClientRect();
		const pickerW = 240;
		const pickerH = 260;
		let left = rect.left;
		let top = rect.bottom + 6;
		if (left + pickerW > window.innerWidth - 8) left = window.innerWidth - pickerW - 8;
		if (top + pickerH > window.innerHeight - 8) top = rect.top - pickerH - 6;
		if (left < 8) left = 8;
		if (top < 8) top = 8;
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
		<div class="reaction-picker" ref="pickerRef" :style="pickerStyle">
			<div class="rp-search-row">
				<Icon icon="mdi:magnify" class="rp-search-icon" />
				<input v-model="search" class="rp-search" placeholder="Search" autofocus />
			</div>

			<div class="rp-grid">
				<button
					v-for="emoji in filteredEmojis"
					:key="emoji"
					class="rp-emoji"
					@click="selectEmoji(emoji)"
				>{{ emoji }}</button>
				<div v-if="filteredEmojis.length === 0" class="rp-empty">No emoji</div>
			</div>
		</div>
	</Teleport>
</template>

<style scoped>
	.reaction-picker {
		width: 240px;
		height: 260px;
		display: flex;
		flex-direction: column;
		background: linear-gradient(180deg, var(--bg-darker) 0%, var(--bg-darkest, #1a1a1f) 100%);
		border: 1px solid rgba(255, 255, 255, 0.07);
		border-radius: 8px;
		overflow: hidden;
		z-index: 500;
		box-shadow:
			0 8px 24px rgba(0, 0, 0, 0.5),
			0 2px 8px rgba(0, 0, 0, 0.3);
		user-select: none;
		font-family: Arial, Helvetica, sans-serif;
		animation: rp-pop 0.12s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	@keyframes rp-pop {
		from {
			opacity: 0;
			transform: translateY(4px) scale(0.95);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	.reaction-picker button,
	.reaction-picker input {
		font-family: inherit;
	}

	.rp-search-row {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 6px 6px 4px;
		padding: 5px 8px;
		background: rgba(0, 0, 0, 0.25);
		border: 1px solid rgba(255, 255, 255, 0.04);
		border-radius: 6px;
		transition: border-color 0.12s ease;
	}

	.rp-search-row:focus-within {
		border-color: rgba(255, 255, 255, 0.15);
	}

	.rp-search-icon {
		color: var(--text-muted);
		font-size: 0.85rem;
		flex-shrink: 0;
	}

	.rp-search {
		flex: 1;
		background: none;
		border: none;
		outline: none;
		color: var(--text);
		font-size: 0.78rem;
		min-width: 0;
	}

	.rp-search::placeholder {
		color: var(--text-muted);
		opacity: 0.6;
	}

	.rp-grid {
		flex: 1;
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 2px;
		padding: 4px 6px 6px;
		overflow-y: auto;
		align-content: start;
		scrollbar-width: thin;
		scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
	}

	.rp-grid::-webkit-scrollbar {
		width: 5px;
	}

	.rp-grid::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.1);
		border-radius: 3px;
	}

	.rp-grid::-webkit-scrollbar-track {
		background: transparent;
	}

	.rp-emoji {
		background: none;
		border: none;
		font-size: 1.15rem;
		line-height: 1;
		aspect-ratio: 1;
		width: 100%;
		border-radius: 5px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.1s ease;
		padding: 0;
	}

	.rp-emoji:hover {
		background: rgba(255, 255, 255, 0.08);
	}

	.rp-empty {
		grid-column: 1 / -1;
		text-align: center;
		padding: 20px;
		color: var(--text-muted);
		font-size: 0.8rem;
		opacity: 0.6;
	}
</style>
