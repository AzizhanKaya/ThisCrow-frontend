import type { id } from '@/types';

export function generate_uid(userId: id): bigint {
	const high = BigInt(userId) & 0xffffffffn;

	const array = new Uint32Array(1);
	crypto.getRandomValues(array);
	const low = BigInt(array[0]);

	const id = (high << 32n) | low;

	return id;
}
