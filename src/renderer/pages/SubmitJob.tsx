import React, { useState, useEffect } from 'react';
import { Send, Upload, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { useIPC } from '../hooks/useIPC';
import { IPC } from '../../shared/ipc-channels';
import type { JobPriority, JobType, OllamaModel } from '../../shared/types';

export function SubmitJob() {
  const navigate = useNavigate();
  const { invoke } = useIPC();
  const { peers, ollamaModels } = useStore();

  const [jobType, setJobType] = useState<JobType>('llm_single');
  const [modelName, setModelName] = useState('');
  const [promptText, setPromptText] = useState('');
  const [batchText, setBatchText] = useState('');
  const [priority, setPriority] = useState<JobPriority>('normal');
  const [selectedPeers, setSelectedPeers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onlinePeers = peers.filter((p) => p.status !== 'offline');

  const parsePrompts = (): string[] => {
    if (jobType === 'llm_single') {
      return promptText.trim() ? [promptText.trim()] : [];
    }
    return batchText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  };

  const handleSubmit = async () => {
    const prompts = parsePrompts();
    if (!prompts.length) {
      setError('Enter at least one prompt');
      return;
    }
    if (!modelName.trim()) {
      setError('Select a model');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await invoke<{ jobId: string }>(IPC.JOBS_SUBMIT, {
        jobType,
        modelName: modelName.trim(),
        prompts,
        priority,
        preferredPeerIds: selectedPeers.length ? selectedPeers : undefined,
      });
      if (result?.jobId) {
        navigate('/jobs');
      }
    } catch (e) {
      setError('Failed to submit job');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Submit Job</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Run inference on the pool
        </p>
      </div>

      {/* Job type */}
      <div className="card space-y-4">
        <div>
          <div className="label mb-2">Job Type</div>
          <div className="flex gap-2">
            {([
              { v: 'llm_single', label: 'Single Prompt' },
              { v: 'llm_batch', label: 'Batch Inference' },
            ] as { v: JobType; label: string }[]).map(({ v, label }) => (
              <button
                key={v}
                onClick={() => setJobType(v)}
                className={`btn ${
                  jobType === v
                    ? 'bg-indigo-600 text-white'
                    : 'btn-secondary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Model */}
        <div>
          <label className="label mb-2 block">Model</label>
          <input
            className="input"
            list="models-list"
            placeholder="e.g. llama3:8b"
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
          />
          <datalist id="models-list">
            {ollamaModels.map((m) => (
              <option key={m.name} value={m.name} />
            ))}
          </datalist>
        </div>

        {/* Input */}
        {jobType === 'llm_single' ? (
          <div>
            <label className="label mb-2 block">Prompt</label>
            <textarea
              className="input min-h-[120px] resize-y"
              placeholder="Enter your prompt..."
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
            />
          </div>
        ) : (
          <div>
            <label className="label mb-2 block">Prompts (one per line)</label>
            <textarea
              className="input min-h-[160px] resize-y font-mono text-xs"
              placeholder="Prompt 1&#10;Prompt 2&#10;Prompt 3..."
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
            />
            <p className="text-xs text-slate-500 mt-1">
              {batchText.split('\n').filter((l) => l.trim()).length} prompts
            </p>
          </div>
        )}
      </div>

      {/* Advanced */}
      <div className="card space-y-4">
        <div className="text-sm font-medium text-slate-300">Advanced Options</div>

        {/* Priority */}
        <div>
          <div className="label mb-2">Priority</div>
          <div className="flex gap-2">
            {(['low', 'normal', 'high'] as JobPriority[]).map((p) => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className={`btn capitalize ${
                  priority === p ? 'bg-indigo-600 text-white' : 'btn-secondary'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Peer selection */}
        {onlinePeers.length > 0 && (
          <div>
            <div className="label mb-2">Preferred Machines (optional)</div>
            <div className="flex flex-wrap gap-2">
              {onlinePeers.map((peer) => {
                const selected = selectedPeers.includes(peer.peerId);
                return (
                  <button
                    key={peer.peerId}
                    onClick={() =>
                      setSelectedPeers((prev) =>
                        selected
                          ? prev.filter((id) => id !== peer.peerId)
                          : [...prev, peer.peerId]
                      )
                    }
                    className={`btn text-xs ${
                      selected ? 'bg-indigo-600 text-white' : 'btn-secondary'
                    }`}
                  >
                    {peer.displayName}
                    {peer.isLocal && ' (you)'}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="card bg-red-900/30 border-red-700 text-red-400 text-sm">
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="btn-primary px-8"
      >
        <Send size={16} />
        {loading ? 'Submitting...' : 'Submit Job'}
      </button>
    </div>
  );
}
