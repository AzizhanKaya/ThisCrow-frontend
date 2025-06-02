import { ref, onMounted, onUnmounted } from 'vue';

export function useScroll(loadMore: () => Promise<void>) {
	const scrollRef = ref<HTMLElement | null>(null);
	const isLoading = ref(false);

	async function handleScroll() {
		if (!scrollRef.value || isLoading.value) return;

		if (scrollRef.value.scrollTop === 0) {
			isLoading.value = true;
			await loadMore();
			isLoading.value = false;
		}
	}

	function updateScrollPadding() {
		if (!scrollRef.value) return;

		const currentScrollHeight = scrollRef.value.scrollHeight;
		const currentScrollTop = scrollRef.value.scrollTop;

		requestAnimationFrame(() => {
			const newScrollHeight = scrollRef.value!.scrollHeight;
			const heightDiff = newScrollHeight - currentScrollHeight;

			if (heightDiff > 0) {
				scrollRef.value!.scrollTop = currentScrollTop + heightDiff;
			}
		});
	}

	onMounted(() => {
		scrollRef.value?.addEventListener('scroll', handleScroll);
	});

	onUnmounted(() => {
		scrollRef.value?.removeEventListener('scroll', handleScroll);
	});

	return {
		scrollRef,
		isLoading,
		updateScrollPadding,
		handleScroll,
	};
}
