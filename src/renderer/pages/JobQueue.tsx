import React, { useState } from 'react';
import { RefreshCw, Filter } from 'lucide-react';
import { useStore } from '../store';
import { useJobs } from '../hooks/useJobs';
import { JobRow } from '../components/JobRow';
import type { Job } from '../../shared/types';

type FilterType = 'all' | 'active' | 'completed' | 'failed';

export function JobQueue() {
  const { jobs } = useStore();
  const { refresh } = useJobs();
  const [filter, setFilter] = useState<FilterType>('all');

  const filtered = jobs.filter((j) => {
    if (filter === 'all') return true;
    if (filter === 'active') return j.status === 'running' || j.status === 'queued';
    if (filter === 'completed') return j.status === 'completed';
    if (filter === 'failed')
      return j.status === 'failed' || j.status === 'cancelled' || j.status === 'preempted';
    return true;
  });

  const active = jobs.filter(
    (j) => j.status === 'running' || j.status === 'queued'
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Job Queue</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {active.length} active · {jobs.length} total
          </p>
        </div>
        <button onClick={refresh} className="btn-secondary">
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-slate-800 border border-slate-700 p-1 rounded-lg w-fit">
        {(['all', 'active', 'completed', 'failed'] as FilterType[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded text-sm font-medium capitalize transition-colors
              ${filter === f
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
              }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Job list */}
      {filtered.length === 0 ? (
        <div className="card text-center py-10 text-slate-500">
          <p>No jobs{filter !== 'all' ? ` in "${filter}"` : ''}</p>
        </div>
      ) : (
        <div className="card divide-y divide-slate-700/50 p-0 overflow-hidden">
          {filtered.map((job) => (
            <JobRow key={job.jobId} job={job} onRefresh={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}
