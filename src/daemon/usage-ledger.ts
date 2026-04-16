import { getUsageSummary, getUsageHistory, recordUsage } from './db';
import type { UsageSummary } from '../shared/types';

interface RawSummaryRow {
  peer_id: string;
  display_name: string;
  gpu_seconds_contributed: number;
  gpu_seconds_consumed: number;
}

export class UsageLedger {
  getSummary(): UsageSummary[] {
    const rows = getUsageSummary() as RawSummaryRow[];
    return rows.map((r) => ({
      peerId: r.peer_id,
      displayName: r.display_name,
      gpuSecondsContributed: r.gpu_seconds_contributed,
      gpuSecondsConsumed: r.gpu_seconds_consumed,
      netBalance: r.gpu_seconds_contributed - r.gpu_seconds_consumed,
    }));
  }

  getHistory(days: number): unknown[] {
    return getUsageHistory(days);
  }

  record(entry: {
    peerId: string;
    direction: 'contributed' | 'consumed';
    gpuSeconds: number;
    cpuSeconds?: number;
    bytesTransferred?: number;
    jobId?: string;
  }): void {
    recordUsage(entry);
  }
}
