import React from 'react';
import { X, RotateCcw, ChevronRight } from 'lucide-react';
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
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-700/50 rounded-lg transition-colors group">
      {/* Status */}
      <span className={`badge ${STATUS_BADGE[job.status]} capitalize w-20 justify-center`}>
        {job.status}
      </span>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-200 truncate">
            {job.modelName ?? job.jobType}
          </span>
          <span className="text-xs text-slate-500 capitalize">{job.jobType.replace('_', ' ')}</span>
        </div>
        {job.inputSummary && (
          <div className="text-xs text-slate-500 truncate">{job.inputSummary}</div>
        )}
        {/* Progress bar for running jobs */}
        {job.status === 'running' && job.progress !== undefined && (
          <div className="mt-1 w-full bg-slate-700 rounded-full h-1">
            <div
              className="h-1 rounded-full bg-indigo-500 transition-all duration-500"
              style={{ width: `${job.progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="hidden sm:flex items-center gap-4 text-xs text-slate-500 shrink-0">
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
        <ChevronRight size={14} className="text-slate-600" />
      </div>
    </div>
  );
}
