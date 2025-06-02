import { ref, computed } from 'vue';

interface SelectedFiles {
	images: Array<{ url: string; file: File }>;
	videos: Array<{ url: string; file: File }>;
	files: Array<{ url: string; name: string; size: string; file: File }>;
}

export function useFiles() {
	const fileInput = ref<HTMLInputElement | null>(null);
	const selectedFiles = ref<SelectedFiles>({
		images: [],
		videos: [],
		files: [],
	});

	const hasSelectedFiles = computed(() => {
		return selectedFiles.value.images.length > 0 || selectedFiles.value.videos.length > 0 || selectedFiles.value.files.length > 0;
	});

	function formatFileSize(bytes: number): string {
		if (bytes < 1024) return bytes + ' B';
		const kb = bytes / 1024;
		if (kb < 1024) return kb.toFixed(1) + ' KB';
		const mb = kb / 1024;
		if (mb < 1024) return mb.toFixed(1) + ' MB';
		const gb = mb / 1024;
		return gb.toFixed(1) + ' GB';
	}

	function handleFileSelect(event: Event) {
		const files = (event.target as HTMLInputElement).files;
		if (!files) return;

		Array.from(files).forEach((file) => {
			if (file.type.startsWith('image/')) {
				selectedFiles.value.images.push({
					url: URL.createObjectURL(file),
					file,
				});
			} else if (file.type.startsWith('video/')) {
				selectedFiles.value.videos.push({
					url: URL.createObjectURL(file),
					file,
				});
			} else {
				selectedFiles.value.files.push({
					url: URL.createObjectURL(file),
					name: file.name,
					size: formatFileSize(file.size),
					file,
				});
			}
		});

		if (fileInput.value) {
			fileInput.value.value = '';
		}
	}

	function removeFile(type: keyof SelectedFiles, index: number) {
		selectedFiles.value[type].splice(index, 1);
	}

	function clearFiles() {
		selectedFiles.value = {
			images: [],
			videos: [],
			files: [],
		};
	}

	return {
		fileInput,
		selectedFiles,
		hasSelectedFiles,
		handleFileSelect,
		removeFile,
		clearFiles,
	};
}
