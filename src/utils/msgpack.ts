import { decode, encode } from '@msgpack/msgpack';

export { encode, decode };

export async function msgFetch<T>(url: string, init?: RequestInit): Promise<T> {
	const res = await fetch(url, {
		...init,
		headers: {
			Accept: 'application/msgpack',
			...(init?.body ? { 'Content-Type': 'application/msgpack' } : {}),
			...init?.headers,
		},
	});

	const buffer = await res.arrayBuffer();

	if (!res.ok) throw new Error(await res.text());

	if (buffer.byteLength === 0) {
		return null as T;
	}

	return decode(new Uint8Array(buffer)) as T;
}
