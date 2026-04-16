import React, { useEffect, useState } from 'react';
import { Save, RefreshCw, Wifi, Bot, Bell, Shield } from 'lucide-react';
import { useStore } from '../store';
import { useIPC } from '../hooks/useIPC';
import { IPC } from '../../shared/ipc-channels';
import type { AppSettings } from '../../shared/types';

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className="w-10 h-[22px] rounded-full transition-all duration-200 shrink-0 relative"
      style={{
        background: checked ? '#58e6d9' : '#21262d',
        boxShadow: checked ? '0 0 12px rgba(88, 230, 217, 0.2)' : 'none',
      }}
    >
      <div
        className="absolute top-[3px] w-4 h-4 rounded-full transition-transform duration-200"
        style={{
          background: checked ? '#06080d' : '#484f58',
          transform: checked ? 'translateX(22px)' : 'translateX(3px)',
        }}
      />
    </button>
  );
}

function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <Icon size={14} style={{ color: '#58e6d9' }} />
      <span className="section-title" style={{ marginBottom: 0 }}>{label}</span>
    </div>
  );
}

export function Settings() {
  const { invoke } = useIPC();
  const { settings, setSettings, group, setGroup } = useStore();
  const [local, setLocal] = useState<AppSettings>(settings);
  const [saved, setSaved] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    invoke<AppSettings>(IPC.SETTINGS_GET).then((s) => {
      if (s) {
        setSettings(s);
        setLocal(s);
      }
    });
    invoke<string>(IPC.GROUP_GET_INVITE_CODE).then((code) => {
      if (code) setInviteCode(code);
    });
  }, [setSettings]);

  const save = async () => {
    await invoke(IPC.SETTINGS_UPDATE, local);
    setSettings(local);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const update = (key: keyof AppSettings, value: unknown) =>
    setLocal((prev) => ({ ...prev, [key]: value }));

  const copyInviteCode = () => {
    navigator.clipboard.writeText(inviteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const leaveGroup = async () => {
    if (confirm('Leave this pool? You can rejoin with an invite code.')) {
      await invoke(IPC.GROUP_LEAVE);
      setGroup(null);
    }
  };

  return (
    <div className="p-8 max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">configure your machine's participation</p>
        </div>
        <button onClick={save} className="btn-primary">
          <Save size={14} />
          {saved ? 'Saved!' : 'Save'}
        </button>
      </div>

      {/* Identity */}
      <div className="card space-y-4 animate-fade-up" style={{ animationDelay: '60ms' }}>
        <SectionHeader icon={Shield} label="Identity" />
        <div>
          <label className="label mb-2.5 block">Display Name</label>
          <input
            className="input"
            value={local.displayName}
            onChange={(e) => update('displayName', e.target.value)}
            placeholder="My Machine"
          />
        </div>
      </div>

      {/* Resource sharing */}
      <div className="card space-y-5 animate-fade-up" style={{ animationDelay: '120ms' }}>
        <SectionHeader icon={RefreshCw} label="Resource Sharing" />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label mb-2.5 block">Max VRAM to Share (MB)</label>
            <input
              type="number"
              className="input font-mono"
              value={local.maxVramShareMb}
              onChange={(e) => update('maxVramShareMb', Number(e.target.value))}
              placeholder="0 = unlimited"
              min={0}
            />
            <p className="font-mono text-[10px] mt-1.5" style={{ color: '#484f58' }}>0 = no limit</p>
          </div>
          <div>
            <label className="label mb-2.5 block">Max CPU Cores to Share</label>
            <input
              type="number"
              className="input font-mono"
              value={local.maxCpuCoresShare}
              onChange={(e) => update('maxCpuCoresShare', Number(e.target.value))}
              placeholder="0 = unlimited"
              min={0}
            />
            <p className="font-mono text-[10px] mt-1.5" style={{ color: '#484f58' }}>0 = no limit</p>
          </div>
        </div>

        <div>
          <div className="label mb-2.5">Do Not Disturb</div>
          <label className="flex items-center gap-3 cursor-pointer">
            <Toggle
              checked={local.dndEnabled}
              onChange={() => update('dndEnabled', !local.dndEnabled)}
            />
            <span className="text-sm" style={{ color: '#7d8590' }}>
              Don't accept any remote work
            </span>
          </label>
        </div>
      </div>

      {/* Ollama */}
      <div className="card space-y-4 animate-fade-up" style={{ animationDelay: '180ms' }}>
        <SectionHeader icon={Bot} label="Ollama" />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label mb-2.5 block">Ollama Port</label>
            <input
              type="number"
              className="input font-mono"
              value={local.ollamaPort}
              onChange={(e) => update('ollamaPort', Number(e.target.value))}
              min={1024}
              max={65535}
            />
          </div>
          <div>
            <label className="label mb-2.5 block">Ollama Binary Path</label>
            <input
              className="input font-mono"
              value={local.ollamaPath}
              onChange={(e) => update('ollamaPath', e.target.value)}
              placeholder="ollama (auto-detect)"
            />
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="card space-y-3.5 animate-fade-up" style={{ animationDelay: '240ms' }}>
        <SectionHeader icon={Bell} label="Notifications" />
        {(
          [
            { key: 'notifyJobComplete', label: 'Job completed' },
            { key: 'notifyPeerJoined', label: 'Peer joined or left' },
            { key: 'notifyPreemption', label: 'Job preempted' },
          ] as { key: keyof AppSettings; label: string }[]
        ).map(({ key, label }) => (
          <label key={key} className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={local[key] as boolean}
              onChange={(e) => update(key, e.target.checked)}
              className="w-4 h-4 rounded"
              style={{ accentColor: '#58e6d9' }}
            />
            <span className="text-sm" style={{ color: '#7d8590' }}>{label}</span>
          </label>
        ))}
      </div>

      {/* Group management */}
      {group && (
        <div className="card space-y-4 animate-fade-up" style={{ animationDelay: '300ms' }}>
          <SectionHeader icon={Wifi} label="Group Management" />
          {inviteCode && (
            <div>
              <div className="label mb-2.5">Invite Code</div>
              <div className="flex items-center gap-2">
                <code
                  className="flex-1 text-center font-mono tracking-[0.2em] py-2.5 rounded-lg"
                  style={{ background: '#0d1117', border: '1px solid #21262d', color: '#58e6d9' }}
                >
                  {inviteCode}
                </code>
                <button onClick={copyInviteCode} className="btn-secondary">
                  {copiedCode ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          )}
          <button onClick={leaveGroup} className="btn-danger">
            Leave Pool
          </button>
        </div>
      )}
    </div>
  );
}
