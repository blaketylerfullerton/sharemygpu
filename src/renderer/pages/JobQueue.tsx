import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useStore } from '../store';
import { useJobs } from '../hooks/useJobs';
import { JobRow } from '../components/JobRow';

type FilterType = 'all' | 'active' | 'completed' | 'failed';

const FILTERS: FilterType[] = ['all', 'active', 'completed', 'failed'];

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
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="page-title">Job Queue</h1>
          <p className="page-sub">
            {active.length} active · {jobs.length} total
          </p>
        </div>
        <button onClick={refresh} className="btn-secondary">
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div
        className="inline-flex gap-0.5 p-1 rounded-lg animate-fade-up"
        style={{ background: '#0d1117', border: '1px solid #21262d', animationDelay: '60ms' }}
      >
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-4 py-1.5 rounded-md font-mono text-[11px] font-semibold capitalize transition-all duration-200"
            style={{
              background: filter === f ? '#58e6d9' : 'transparent',
              color: filter === f ? '#06080d' : '#7d8590',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Job list */}
      {filtered.length === 0 ? (
        <div
          className="card text-center py-10 animate-fade-up"
          style={{ animationDelay: '120ms' }}
        >
          <p className="font-mono text-sm" style={{ color: '#484f58' }}>
            No jobs{filter !== 'all' ? ` in "${filter}"` : ''}
          </p>
        </div>
      ) : (
        <div
          className="card p-0 overflow-hidden animate-fade-up"
          style={{ animationDelay: '120ms' }}
        >
          {filtered.map((job) => (
            <JobRow key={job.jobId} job={job} onRefresh={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}
