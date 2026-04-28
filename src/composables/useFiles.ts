import { ref, computed } from 'vue';
import { API_URL } from '@/constants';
import { encode, msgFetch } from '@/utils/msgpack';

export type StorageType = 'image' | 'video' | 'file' | 'avatar' | 'icon' | 'banner';

interface SelectedFiles {
	images: Array<{ url: string; file: File }>;
	videos: Array<{ url: string; file: File }>;
	files: Array<{ url: string; name: string; size: string; file: File }>;
}

export interface FileInfo {
	name: string;
	size: number | string;
	extension: string;
	url: string;
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

		const uploaded = await uploadFiles(Array.from(files));

		uploaded.forEach((info) => {
			const file = info.file;
			const url = info.url;

			if (info.type === 'image') {
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

	async function uploadFiles(files: File[], overrideStorageType?: StorageType) {
		const uploaded: Array<{
			file: File;
			type: StorageType;
			url: string;
		}> = [];

		for (const file of files) {
			let storageType: StorageType = overrideStorageType || getFileType(file);

			try {
				const signature = await msgFetch<{
					original_filename: string;
					saved_filename: string;
					signed_url: string;
					public_url: string;
				}>(`${API_URL}/upload`, {
					method: 'PUT',
					credentials: 'include',
					body: encode({
						filename: file.name,
						content_type: file.type || 'application/octet-stream',
						storage_type: storageType,
					}),
				});

				const uploadResponse = await fetch(signature.signed_url, {
					method: 'PUT',
					headers: {
						'Content-Type': file.type || 'application/octet-stream',
					},
					body: file,
				});

				if (!uploadResponse.ok) throw new Error('Upload to storage failed');

				uploaded.push({
					file,
					type: storageType,
					url: signature.public_url,
				});
			} catch (error) {
				console.error('Upload error:', error);
			}
		}

		return uploaded;
	}

	function getFileType(file: File): StorageType {
		const mime = file.type;

		if (mime.startsWith('image/')) return 'image';
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
		uploadFiles,
	};
}
