import { useEffect, useCallback } from 'react';
import { useStore } from '../store';
import { useIPC } from './useIPC';
import { IPC, IPC_EVENTS } from '../../shared/ipc-channels';
import type { Job } from '../../shared/types';

const noop = () => {};

function safeOn(channel: string, cb: (...args: unknown[]) => void): () => void {
  if (!window.electronAPI) return noop;
  return window.electronAPI.on(channel, cb);
}

export function useJobs() {
  const { invoke } = useIPC();
  const { setJobs, updateJob, setAppStatus } = useStore();

  const refresh = useCallback(async () => {
    try {
      const jobs = await invoke<Job[]>(IPC.JOBS_LIST);
      if (jobs) {
        setJobs(jobs);
        const running = jobs.filter((j) => j.status === 'running').length;
        setAppStatus({ jobsRunning: running });
      }
    } catch {
      // Daemon not ready yet
    }
  }, [invoke, setJobs, setAppStatus]);

  useEffect(() => {
    refresh();

    const offStatusChanged = safeOn(IPC_EVENTS.JOB_STATUS_CHANGED, (data) => {
      const { jobId, status } = data as { jobId: string; status: Job['status'] };
      updateJob(jobId, { status });
      refresh();
    });

    const offProgress = safeOn(IPC_EVENTS.JOB_PROGRESS, (data) => {
      const { jobId, progress } = data as { jobId: string; progress: number };
      updateJob(jobId, { progress });
    });

    const offCompleted = safeOn(IPC_EVENTS.JOB_COMPLETED, () => refresh());

    const offPreempted = safeOn(IPC_EVENTS.JOB_PREEMPTED, (data) => {
      const { jobId } = data as { jobId: string };
      updateJob(jobId, { status: 'preempted' });
    });

    const interval = setInterval(refresh, 10_000);

    return () => {
      offStatusChanged();
      offProgress();
      offCompleted();
      offPreempted();
      clearInterval(interval);
    };
  }, [refresh, updateJob]);

  return { refresh };
}
