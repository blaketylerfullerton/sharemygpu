import { EventEmitter } from 'events';
import {
  IDLE_GPU_UTILIZATION_THRESHOLD,
  IDLE_GPU_CONSECUTIVE_SECONDS,
  BUSY_GPU_UTILIZATION_THRESHOLD,
  PREEMPTION_GRACE_PERIOD_MS,
  GPU_POLL_INTERVAL_MS,
} from '../shared/constants';
import type { OwnerActivity, ResourceStatus } from '../shared/types';

export class IdleDetector extends EventEmitter {
  private currentActivity: OwnerActivity = 'IDLE';
  private dndEnabled = false;
  private consecutiveIdleSamples = 0;
  private readonly idleSamplesRequired = Math.ceil(
    (IDLE_GPU_CONSECUTIVE_SECONDS * 1000) / GPU_POLL_INTERVAL_MS
  );

  setDnd(enabled: boolean): void {
    this.dndEnabled = enabled;
    this.recalculate(null);
  }

  update(resource: ResourceStatus): void {
    this.recalculate(resource);
  }

  getActivity(): OwnerActivity {
    return this.currentActivity;
  }

  private recalculate(resource: ResourceStatus | null): void {
    if (this.dndEnabled) {
      this.setActivity('DO_NOT_DISTURB');
      return;
    }

    if (!resource) {
      this.setActivity('IDLE');
      return;
    }

    const gpu = resource.gpuUtilizationPct;

    if (gpu >= BUSY_GPU_UTILIZATION_THRESHOLD) {
      this.consecutiveIdleSamples = 0;
      this.setActivity('HEAVY_USE');
    } else if (gpu >= IDLE_GPU_UTILIZATION_THRESHOLD) {
      this.consecutiveIdleSamples = 0;
      this.setActivity('LIGHT_USE');
    } else {
      this.consecutiveIdleSamples++;
      if (this.consecutiveIdleSamples >= this.idleSamplesRequired) {
        this.setActivity('IDLE');
      }
    }
  }

  private setActivity(activity: OwnerActivity): void {
    if (this.currentActivity !== activity) {
      const prev = this.currentActivity;
      this.currentActivity = activity;
      this.emit('change', activity, prev);
    }
  }

  shouldAcceptWork(): boolean {
    return (
      this.currentActivity === 'IDLE' || this.currentActivity === 'LIGHT_USE'
    );
  }

  shouldPreempt(): boolean {
    return (
      this.currentActivity === 'HEAVY_USE' ||
      this.currentActivity === 'DO_NOT_DISTURB'
    );
  }
}
