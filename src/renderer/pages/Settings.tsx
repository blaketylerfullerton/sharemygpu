import React, { useEffect, useState } from 'react';
import { Save, RefreshCw, Wifi, Bot, Bell, Shield } from 'lucide-react';
import { useStore } from '../store';
import { useIPC } from '../hooks/useIPC';
import { IPC } from '../../shared/ipc-channels';
import type { AppSettings } from '../../shared/types';

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
  }, [invoke, setSettings]);

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
    <div className="p-6 max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Settings</h1>
          <p className="text-sm text-slate-400 mt-0.5">Configure your machine's participation</p>
        </div>
        <button onClick={save} className="btn-primary">
          <Save size={14} />
          {saved ? 'Saved!' : 'Save'}
        </button>
      </div>

      {/* Identity */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-1">
          <Shield size={14} />
          Identity
        </div>
        <div>
          <label className="label mb-2 block">Display Name</label>
          <input
            className="input"
            value={local.displayName}
            onChange={(e) => update('displayName', e.target.value)}
            placeholder="My Machine"
          />
        </div>
      </div>

      {/* Resource limits */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-1">
          <RefreshCw size={14} />
          Resource Sharing
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label mb-2 block">Max VRAM to Share (MB)</label>
            <input
              type="number"
              className="input"
              value={local.maxVramShareMb}
              onChange={(e) => update('maxVramShareMb', Number(e.target.value))}
              placeholder="0 = unlimited"
              min={0}
            />
            <p className="text-xs text-slate-500 mt-1">0 = no limit</p>
          </div>
          <div>
            <label className="label mb-2 block">Max CPU Cores to Share</label>
            <input
              type="number"
              className="input"
              value={local.maxCpuCoresShare}
              onChange={(e) => update('maxCpuCoresShare', Number(e.target.value))}
              placeholder="0 = unlimited"
              min={0}
            />
            <p className="text-xs text-slate-500 mt-1">0 = no limit</p>
          </div>
        </div>

        <div>
          <div className="label mb-2">Do Not Disturb</div>
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => update('dndEnabled', !local.dndEnabled)}
              className={`w-10 h-6 rounded-full transition-colors cursor-pointer
                ${local.dndEnabled ? 'bg-indigo-600' : 'bg-slate-600'}`}
            >
              <div
                className={`w-4 h-4 bg-white rounded-full shadow transition-transform mt-1
                  ${local.dndEnabled ? 'translate-x-5' : 'translate-x-1'}`}
              />
            </div>
            <span className="text-sm text-slate-300">
              Don't accept any remote work
            </span>
          </label>
        </div>
      </div>

      {/* Ollama */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-1">
          <Bot size={14} />
          Ollama
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label mb-2 block">Ollama Port</label>
            <input
              type="number"
              className="input"
              value={local.ollamaPort}
              onChange={(e) => update('ollamaPort', Number(e.target.value))}
              min={1024}
              max={65535}
            />
          </div>
          <div>
            <label className="label mb-2 block">Ollama Binary Path</label>
            <input
              className="input"
              value={local.ollamaPath}
              onChange={(e) => update('ollamaPath', e.target.value)}
              placeholder="ollama (auto-detect)"
            />
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="card space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-1">
          <Bell size={14} />
          Notifications
        </div>
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
              className="w-4 h-4 accent-indigo-500"
            />
            <span className="text-sm text-slate-300">{label}</span>
          </label>
        ))}
      </div>

      {/* Group management */}
      {group && (
        <div className="card space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-1">
            <Wifi size={14} />
            Group Management
          </div>
          {inviteCode && (
            <div>
              <div className="label mb-2">Invite Code</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-center font-mono tracking-widest text-indigo-300
                  bg-slate-900 border border-slate-600 rounded-lg py-2">
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
