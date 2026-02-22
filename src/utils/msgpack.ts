import { decode as msgDecode, encode as msgEncode, ExtensionCodec, type EncoderOptions, type DecoderOptions } from '@msgpack/msgpack';

const convertToBigInt = (obj: any): any => {
	if (typeof obj === 'number') return BigInt(obj);
	if (Array.isArray(obj)) return obj.map(convertToBigInt);
	if (obj !== null && typeof obj === 'object') {
		return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, convertToBigInt(v)]));
	}
	return obj;
};

export const encode = (value: unknown, options?: EncoderOptions) =>
	msgEncode(value, {
		useBigInt64: true,
		...options,
	});

export const decode = (buffer: ArrayLike<number> | BufferSource, options?: DecoderOptions) => {
	const decoded = msgDecode(buffer, {
		useBigInt64: true,
		...options,
	});

	return convertToBigInt(decoded);
};

export async function msgFetch<T>(url: string, init?: RequestInit): Promise<T> {
	const res = await fetch(url, {
		...init,
		headers: {
			Accept: 'application/msgpack',
			...(init?.body ? { 'Content-Type': 'application/msgpack' } : {}),
			...init?.headers,
		},
	});

	if (!res.ok) throw new Error(await res.text());

	const buffer = await res.arrayBuffer();

	if (buffer.byteLength === 0) {
		return null as T;
	}

	return decode(new Uint8Array(buffer)) as T;
}
