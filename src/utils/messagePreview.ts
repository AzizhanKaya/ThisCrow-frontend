import type { MessageData, MultiData, ReplyData } from '@/types';
import { decrypt_message } from '@/../pkg/wasm_lib';
import { decode } from '@/utils/msgpack';

export function summarizeMessageData(data: MessageData, privateKey?: Uint8Array | null): string {
	let inner: MessageData = data;

	if (inner && typeof inner === 'object' && 'cipher' in inner) {
		if (!privateKey) return '[encrypted]';
		try {
			const decrypted = decrypt_message(privateKey, (inner as any).cipher, (inner as any).nonce);
			inner = decode(decrypted) as MessageData;
		} catch {
			return '[encrypted]';
		}
	}

	if (inner && typeof inner === 'object' && 'replied' in inner && 'data' in inner) {
		inner = (inner as ReplyData).data;
	}

	if (typeof inner === 'string') return inner;

	if (inner && typeof inner === 'object') {
		const md = inner as MultiData;
		if (md.text) return md.text;
		if (md.images?.length) return '📷 Image';
		if (md.videos?.length) return '🎬 Video';
		if (md.files?.length) return '📎 Attachment';
	}

	return '';
}
