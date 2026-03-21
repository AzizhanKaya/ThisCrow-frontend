import { type snowflake_id } from '@/types';

const EPOCH = 1767225600000n;
const SEQUENCE_BITS = 12n;
const NODE_BITS = 8n;

const MAX_SEQUENCE = (1n << SEQUENCE_BITS) - 1n;
const NODE_SHIFT = SEQUENCE_BITS;
const TIMESTAMP_SHIFT = SEQUENCE_BITS + NODE_BITS;

const NODE_ID = 0n;

let lastTs = -1n;
let sequence = 0n;

function currentMillis(): bigint {
	return BigInt(Date.now()) - EPOCH;
}

export function generate_snowflake(): snowflake_id {
	let now = currentMillis();

	if (now <= lastTs) {
		if (sequence === MAX_SEQUENCE) {
			while (now <= lastTs) {
				now = currentMillis();
			}
			sequence = 0n;
		} else {
			sequence += 1n;
			now = lastTs;
		}
	} else {
		sequence = 0n;
	}

	lastTs = now;

	const snowflake = (now << TIMESTAMP_SHIFT) | (NODE_ID << NODE_SHIFT) | sequence;

	return snowflake;
}

export function get_timestamp_from_snowflake(snowflake: bigint): number {
	const timeSinceEpoch = snowflake >> TIMESTAMP_SHIFT;

	const unixTimestamp = timeSinceEpoch + EPOCH;

	return Number(unixTimestamp);
}

export function snowflake_to_date(snowflake: bigint): Date {
	return new Date(get_timestamp_from_snowflake(snowflake));
}

const NODE_MASK = (1n << NODE_BITS) - 1n;

export function is_sent_from_snowflake(snowflake: bigint): boolean {
	const nodeValue = (snowflake >> NODE_SHIFT) & NODE_MASK;

	return nodeValue !== 0n;
}
