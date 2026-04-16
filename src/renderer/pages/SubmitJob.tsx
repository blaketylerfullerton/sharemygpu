import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { useIPC } from '../hooks/useIPC';
import { IPC } from '../../shared/ipc-channels';
import type { JobPriority, JobType } from '../../shared/types';

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

  const ToggleButton = ({
    active,
    onClick,
    children,
  }: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
  }) => (
    <button
      onClick={onClick}
      className="px-4 py-2 rounded-lg font-mono text-[11px] font-semibold transition-all duration-200"
      style={{
        background: active ? '#58e6d9' : '#1c2128',
        color: active ? '#06080d' : '#7d8590',
        border: `1px solid ${active ? '#58e6d9' : '#21262d'}`,
      }}
    >
      {children}
    </button>
  );

  return (
    <div className="p-8 max-w-2xl space-y-6">
      {/* Header */}
      <div className="animate-fade-up">
        <h1 className="page-title">Submit Job</h1>
        <p className="page-sub">dispatch inference across the mesh</p>
      </div>

      {/* Job config card */}
      <div className="card space-y-5 animate-fade-up" style={{ animationDelay: '60ms' }}>
        {/* Job type */}
        <div>
          <div className="label mb-2.5">Job Type</div>
          <div className="flex gap-2">
            <ToggleButton active={jobType === 'llm_single'} onClick={() => setJobType('llm_single')}>
              Single Prompt
            </ToggleButton>
            <ToggleButton active={jobType === 'llm_batch'} onClick={() => setJobType('llm_batch')}>
              Batch Inference
            </ToggleButton>
          </div>
        </div>

        {/* Model */}
        <div>
          <label className="label mb-2.5 block">Model</label>
          <input
            className="input font-mono"
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
            <label className="label mb-2.5 block">Prompt</label>
            <textarea
              className="input min-h-[120px] resize-y"
              placeholder="Enter your prompt..."
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
            />
          </div>
        ) : (
          <div>
            <label className="label mb-2.5 block">Prompts (one per line)</label>
            <textarea
              className="input min-h-[160px] resize-y font-mono text-xs"
              placeholder={'Prompt 1\nPrompt 2\nPrompt 3...'}
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
            />
            <p className="font-mono text-[10px] mt-1.5" style={{ color: '#484f58' }}>
              {batchText.split('\n').filter((l) => l.trim()).length} prompts
            </p>
          </div>
        )}
      </div>

      {/* Advanced options card */}
      <div className="card space-y-5 animate-fade-up" style={{ animationDelay: '120ms' }}>
        <div className="section-title" style={{ marginBottom: 0 }}>Advanced Options</div>

        {/* Priority */}
        <div>
          <div className="label mb-2.5">Priority</div>
          <div className="flex gap-2">
            {(['low', 'normal', 'high'] as JobPriority[]).map((p) => (
              <ToggleButton key={p} active={priority === p} onClick={() => setPriority(p)}>
                {p}
              </ToggleButton>
            ))}
          </div>
        </div>

        {/* Peer selection */}
        {onlinePeers.length > 0 && (
          <div>
            <div className="label mb-2.5">Preferred Machines (optional)</div>
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
                    className="px-3 py-1.5 rounded-lg font-mono text-[10px] font-semibold transition-all duration-200"
                    style={{
                      background: selected ? 'rgba(88, 230, 217, 0.1)' : '#1c2128',
                      color: selected ? '#58e6d9' : '#7d8590',
                      border: `1px solid ${selected ? 'rgba(88, 230, 217, 0.3)' : '#21262d'}`,
                    }}
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

      {/* Error */}
      {error && (
        <div
          className="card animate-fade-up"
          style={{
            background: 'rgba(248, 81, 73, 0.06)',
            borderColor: 'rgba(248, 81, 73, 0.15)',
            color: '#f85149',
            fontSize: '13px',
          }}
        >
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="btn-primary px-8 animate-fade-up"
        style={{ animationDelay: '180ms' }}
      >
        <Send size={16} />
        {loading ? 'Submitting...' : 'Submit Job'}
      </button>
    </div>
  );
}
