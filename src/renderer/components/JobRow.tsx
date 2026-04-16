import React from 'react';
import { X, ChevronRight } from 'lucide-react';
import type { Job } from '../../shared/types';
import { useIPC } from '../hooks/useIPC';
import { IPC } from '../../shared/ipc-channels';

interface Props {
  job: Job;
  onRefresh: () => void;
}

const STATUS_BADGE: Record<Job['status'], string> = {
  queued: 'badge-gray',
  running: 'badge-blue',
  completed: 'badge-green',
  failed: 'badge-red',
  preempted: 'badge-yellow',
  cancelled: 'badge-gray',
};

const STATUS_FILL: Record<Job['status'], string> = {
  queued: '#484f58',
  running: '#58a6ff',
  completed: '#39d353',
  failed: '#f85149',
  preempted: '#e3b341',
  cancelled: '#484f58',
};

export function JobRow({ job, onRefresh }: Props) {
  const { invoke } = useIPC();
  const isActive = job.status === 'running' || job.status === 'queued';

  const cancel = async () => {
    await invoke(IPC.JOBS_CANCEL, job.jobId);
    onRefresh();
  };

  const formatDuration = (): string => {
    if (!job.startedAt) return '—';
    const endMs = job.completedAt ?? Date.now();
    const secs = Math.round((endMs - job.startedAt) / 1000);
    if (secs < 60) return `${secs}s`;
    return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  };

  return (
    <div
      className="flex items-center gap-3 px-4 py-3.5 group transition-colors duration-150"
      style={{ borderBottom: '1px solid rgba(33, 38, 45, 0.5)' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(22, 27, 34, 0.5)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Status badge */}
      <span className={`${STATUS_BADGE[job.status]} capitalize w-20 justify-center`}>
        {job.status}
      </span>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-display text-sm font-semibold truncate" style={{ color: '#e6edf3' }}>
            {job.modelName ?? job.jobType}
          </span>
          <span className="font-mono text-[10px] capitalize" style={{ color: '#484f58' }}>
            {job.jobType.replace('_', ' ')}
          </span>
        </div>
        {job.inputSummary && (
          <div className="font-mono text-[10px] truncate mt-0.5" style={{ color: '#484f58' }}>
            {job.inputSummary}
          </div>
        )}
        {job.status === 'running' && job.progress !== undefined && (
          <div className="mt-2 w-full rounded-full h-[2px]" style={{ background: '#21262d' }}>
            <div
              className="h-[2px] rounded-full transition-all duration-500"
              style={{
                width: `${job.progress}%`,
                background: STATUS_FILL[job.status],
                boxShadow: `0 0 6px rgba(88, 166, 255, 0.3)`,
              }}
            />
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="hidden sm:flex items-center gap-4 font-mono text-[10px] shrink-0" style={{ color: '#484f58' }}>
        {job.inputCount && <span>{job.inputCount} prompts</span>}
        <span>{formatDuration()}</span>
        <span className="capitalize">{job.priority}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {isActive && (
          <button onClick={cancel} className="btn-ghost p-1.5 rounded">
            <X size={14} />
          </button>
        )}
        <ChevronRight size={14} style={{ color: '#30363d' }} />
      </div>
    </div>
  );
}
