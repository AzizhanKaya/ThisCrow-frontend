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

	async function handleFileSelect(event: Event) {
		const files = (event.target as HTMLInputElement).files;
		if (!files) return;

		const filesArray = Array.from(files);

		const uploaded = await uploadFiles(filesArray);

		uploaded.forEach((info, index) => {
			const file = filesArray[index];
			const url = `/uploads/${info.type}/${info.saved_name}`;

			if (info.type === 'img') {
				selectedFiles.value.images.push({ url, file });
			} else if (info.type === 'video') {
				selectedFiles.value.videos.push({ url, file });
			} else {
				selectedFiles.value.files.push({
					url,
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

	async function uploadFiles(files: File[]) {
		const uploaded: Array<{
			file_name: string;
			saved_name: string;
			type: string;
		}> = [];

		const formData = new FormData();

		files.forEach((file) => {
			const type = getFileType(file);
			formData.append(type, file);
		});

		try {
			const response = await fetch('/upload', {
				method: 'POST',
				body: formData,
			});

			if (!response.ok) throw new Error('Upload failed');

			const result = await response.json();

			result.forEach((uploadInfo: { filename: string; saved_name: string; type: string }) => {
				uploaded.push({
					file_name: uploadInfo.filename,
					saved_name: uploadInfo.saved_name,
					type: uploadInfo.type,
				});
			});
		} catch (error) {
			console.error('Upload error:', error);
		}

		return uploaded;
	}

	function getFileType(file: File): 'img' | 'video' | 'file' {
		const mime = file.type;

		if (mime.startsWith('image/')) return 'img';
		if (mime.startsWith('video/')) return 'video';
		return 'file';
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
