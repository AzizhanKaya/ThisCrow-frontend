import { ref, computed, reactive } from 'vue';
import { API_URL } from '@/constants';
import { encode, msgFetch } from '@/utils/msgpack';
import { useErrorStore } from '@/stores/error';

export type StorageType = 'image' | 'video' | 'file' | 'avatar' | 'icon' | 'banner';

interface SelectedImage {
	id: number;
	url: string;
	uploadedUrl?: string;
	file: File;
	uploading: boolean;
	failed?: boolean;
}

interface SelectedVideo {
	id: number;
	url: string;
	uploadedUrl?: string;
	file: File;
	uploading: boolean;
	failed?: boolean;
}

interface SelectedFile {
	id: number;
	url: string;
	name: string;
	size: string;
	file: File;
	uploading: boolean;
	failed?: boolean;
}

interface SelectedFiles {
	images: SelectedImage[];
	videos: SelectedVideo[];
	files: SelectedFile[];
}

export interface FileInfo {
	name: string;
	size: number | string;
	extension: string;
	url: string;
}

let nextFileId = 0;

export function useFiles() {
	const errorStore = useErrorStore();
	const fileInput = ref<HTMLInputElement | null>(null);
	const selectedFiles = ref<SelectedFiles>({
		images: [],
		videos: [],
		files: [],
	});

	const hasSelectedFiles = computed(() => {
		return selectedFiles.value.images.length > 0 || selectedFiles.value.videos.length > 0 || selectedFiles.value.files.length > 0;
	});

	const isUploading = computed(() => {
		return (
			selectedFiles.value.images.some((i) => i.uploading) ||
			selectedFiles.value.videos.some((v) => v.uploading) ||
			selectedFiles.value.files.some((f) => f.uploading)
		);
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
		const fileList = (event.target as HTMLInputElement).files;
		if (!fileList) return;

		await addFiles(Array.from(fileList));

		if (fileInput.value) {
			fileInput.value.value = '';
		}
	}

	async function addFiles(files: File[]) {
		if (files.length === 0) return;

		const placeholders = files.map((file) => {
			const storageType = getFileType(file);
			const localUrl = URL.createObjectURL(file);
			const id = ++nextFileId;

			if (storageType === 'image') {
				const item = reactive<SelectedImage>({ id, url: localUrl, file, uploading: true });
				selectedFiles.value.images.push(item);
				return { item, kind: 'image' as const, storageType };
			} else if (storageType === 'video') {
				const item = reactive<SelectedVideo>({ id, url: localUrl, file, uploading: true });
				selectedFiles.value.videos.push(item);
				return { item, kind: 'video' as const, storageType };
			} else {
				const item = reactive<SelectedFile>({
					id,
					url: localUrl,
					name: file.name,
					size: formatFileSize(file.size),
					file,
					uploading: true,
				});
				selectedFiles.value.files.push(item);
				return { item, kind: 'file' as const, storageType };
			}
		});

		await Promise.all(
			placeholders.map(async (p) => {
				try {
					const result = await uploadSingleFile(p.item.file, p.storageType);
					if (p.kind === 'file') {
						URL.revokeObjectURL(p.item.url);
						p.item.url = result.url;
					} else {
						(p.item as SelectedImage | SelectedVideo).uploadedUrl = result.url;
					}
					p.item.uploading = false;
				} catch (error) {
					console.error('Upload error:', error);
					errorStore.pushFrom(error, `Failed to upload ${p.item.file.name}.`);
					p.item.uploading = false;
					p.item.failed = true;
				}
			})
		);
	}

	function removeFile(type: keyof SelectedFiles, index: number) {
		const arr = selectedFiles.value[type];
		const item = arr[index];
		if (item && item.url.startsWith('blob:')) {
			URL.revokeObjectURL(item.url);
		}
		arr.splice(index, 1);
	}

	function clearFiles() {
		(['images', 'videos', 'files'] as const).forEach((type) => {
			selectedFiles.value[type].forEach((item) => {
				if (item.url.startsWith('blob:')) URL.revokeObjectURL(item.url);
			});
		});
		selectedFiles.value = {
			images: [],
			videos: [],
			files: [],
		};
	}

	async function uploadSingleFile(file: File, storageType: StorageType): Promise<{ url: string }> {
		const signature = await msgFetch<{
			original_filename: string;
			saved_filename: string;
			signed_url: string;
			public_url: string;
			extension_headers: Record<string, string>;
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
				...signature.extension_headers,
			},
			body: file,
		});

		if (!uploadResponse.ok) throw new Error(await uploadResponse.text());

		return { url: signature.public_url };
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
					extension_headers: Record<string, string>;
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
						...signature.extension_headers,
					},
					body: file,
				});

				if (!uploadResponse.ok) throw new Error(await uploadResponse.text());

				uploaded.push({
					file,
					type: storageType,
					url: signature.public_url,
				});
			} catch (error) {
				console.error('Upload error:', error);
				errorStore.pushFrom(error, `Failed to upload ${file.name}.`);
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
		isUploading,
		handleFileSelect,
		addFiles,
		removeFile,
		clearFiles,
		uploadFiles,
	};
}
