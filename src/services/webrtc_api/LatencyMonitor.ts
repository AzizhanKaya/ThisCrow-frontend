import { ref } from 'vue';
import type { id } from '@/types';
import type { PeerConnection } from './types';

export class LatencyMonitor {
	public latencyMs = ref(0);
	private interval?: number;

	constructor(
		private getPeers: () => Map<id, PeerConnection>,
		private pollIntervalMs: number,
	) {}

	start() {
		if (this.interval) return;
		this.interval = window.setInterval(() => this.measure(), this.pollIntervalMs);
		this.measure();
	}

	stop() {
		if (this.interval) {
			clearInterval(this.interval);
			this.interval = undefined;
		}
		this.latencyMs.value = 0;
	}

	private async measure() {
		const peers = Array.from(this.getPeers().values());
		if (peers.length === 0) {
			this.latencyMs.value = 0;
			return;
		}

		let totalRtt = 0;
		let count = 0;

		for (const peer of peers) {
			try {
				const stats = await peer.connection.getStats();
				stats.forEach((report) => {
					if (
						report.type === 'candidate-pair' &&
						report.nominated === true &&
						report.state === 'succeeded' &&
						report.currentRoundTripTime != null
					) {
						totalRtt += report.currentRoundTripTime;
						count++;
					}
				});
			} catch {
				// Stats unavailable for this peer
			}
		}

		if (count > 0) {
			this.latencyMs.value = Math.max(1, Math.round((totalRtt / count) * 1000));
		}
	}
}
