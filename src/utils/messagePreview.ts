import type { MessageData, MultiData, ReplyData } from '@/types';
import { decrypt_message } from '@/../pkg/wasm_lib';
import { decode } from '@/utils/msgpack';

export interface MessageSummary {
	text?: string;
	icons?: string[];
}

export function summarizeMessageData(data: MessageData, privateKey?: Uint8Array | null): MessageSummary {
	let inner: MessageData = data;

	if (inner && typeof inner === 'object' && 'cipher' in inner) {
		if (!privateKey) return { text: '[encrypted]' };
		try {
			const decrypted = decrypt_message(privateKey, (inner as any).cipher, (inner as any).nonce);
			inner = decode(decrypted) as MessageData;
		} catch {
			return { text: '[encrypted]' };
		}
	}

	if (inner && typeof inner === 'object' && 'replied' in inner && 'data' in inner) {
		inner = (inner as ReplyData).data;
	}

	if (typeof inner === 'string') return { text: inner };

	if (inner && typeof inner === 'object') {
		const md = inner as MultiData;
		const icons: string[] = [];
		if (md.images?.length) icons.push('mdi:image');
		if (md.videos?.length) icons.push('mdi:video');
		if (md.files?.length) icons.push('mdi:paperclip');

		return {
			text: md.text || '',
			icons: icons.length > 0 ? icons : undefined
		};
	}

	return { text: '' };
}
