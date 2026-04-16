import React, { useEffect, useState } from 'react';
import { X, Copy, Check, Users, LogIn, Wifi } from 'lucide-react';
import { useIPC } from '../hooks/useIPC';
import { IPC } from '../../shared/ipc-channels';
import { useStore } from '../store';
import type { Group } from '../../shared/types';

interface Props {
  onClose: () => void;
}

type Mode = 'choose' | 'create' | 'join' | 'direct';

export function InviteModal({ onClose }: Props) {
  const { invoke } = useIPC();
  const { setGroup } = useStore();
  const [mode, setMode] = useState<Mode>('choose');
  const [inviteCode, setInviteCode] = useState('');
  const [directAddress, setDirectAddress] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copied, setCopied] = useState(false);
  const [localAddresses, setLocalAddresses] = useState<string[]>([]);

  useEffect(() => {
    if (mode === 'direct') {
      invoke<string[]>(IPC.APP_GET_LOCAL_ADDRESSES)
        .then((addrs) => setLocalAddresses(addrs ?? []))
        .catch(() => {});
    }
  }, [mode, invoke]);

  const handleCreate = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await invoke<{ groupId: string; inviteCode: string }>(
        IPC.GROUP_CREATE
      );
      if (result?.inviteCode) {
        setGeneratedCode(result.inviteCode);
        const group = await invoke<Group>(IPC.GROUP_GET);
        if (group) setGroup(group);
      }
    } catch (e) {
      setError('Failed to create group. Is the daemon running?');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) return;
    setLoading(true);
    setError('');
    try {
      const result = await invoke<{ success: boolean; error?: string }>(
        IPC.GROUP_JOIN,
        inviteCode.trim().toUpperCase()
      );
      if (result?.success) {
        const group = await invoke<Group>(IPC.GROUP_GET);
        if (group) setGroup(group);
        onClose();
      } else {
        setError(result?.error ?? 'Failed to join group');
      }
    } catch (e) {
      setError('Failed to join group');
    } finally {
      setLoading(false);
    }
  };

  const handleDirectConnect = async () => {
    if (!directAddress.trim()) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const result = await invoke<{ peerId: string; latencyMs: number }>(
        IPC.PEER_CONNECT,
        directAddress.trim()
      );
      if (result?.peerId) {
        setSuccess(`Connected! Peer ${result.peerId.slice(0, 8)} (${result.latencyMs}ms)`);
        setTimeout(() => onClose(), 1200);
      } else {
        setError('Failed to connect — no response');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Failed to connect: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="card w-full max-w-md mx-4 relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">
            {mode === 'direct' ? 'Connect on LAN' : 'Join a Pool'}
          </h2>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded">
            <X size={18} />
          </button>
        </div>

        {mode === 'choose' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setMode('create'); handleCreate(); }}
                className="flex flex-col items-center gap-3 p-6 bg-slate-700 hover:bg-slate-600
                  rounded-xl border border-slate-600 hover:border-indigo-500 transition-all"
              >
                <Users size={32} className="text-indigo-400" />
                <div>
                  <div className="font-medium">Create Group</div>
                  <div className="text-xs text-slate-400 mt-0.5">Start a new pool</div>
                </div>
              </button>
              <button
                onClick={() => setMode('join')}
                className="flex flex-col items-center gap-3 p-6 bg-slate-700 hover:bg-slate-600
                  rounded-xl border border-slate-600 hover:border-indigo-500 transition-all"
              >
                <LogIn size={32} className="text-green-400" />
                <div>
                  <div className="font-medium">Join Group</div>
                  <div className="text-xs text-slate-400 mt-0.5">Enter invite code</div>
                </div>
              </button>
            </div>
            <button
              onClick={() => setMode('direct')}
              className="flex items-center gap-3 w-full p-4 bg-slate-700 hover:bg-slate-600
                rounded-xl border border-slate-600 hover:border-sky-500 transition-all"
            >
              <Wifi size={24} className="text-sky-400" />
              <div className="text-left">
                <div className="font-medium">Connect on LAN</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Enter another machine's IP directly (no invite code)
                </div>
              </div>
            </button>
          </div>
        )}

        {mode === 'create' && (
          <div>
            {loading && !generatedCode && (
              <div className="text-center py-8 text-slate-400">
                Creating group...
              </div>
            )}
            {generatedCode && (
              <div>
                <p className="text-sm text-slate-400 mb-4">
                  Share this code with friends to let them join your pool.
                  It expires in 24 hours.
                </p>
                <div className="flex items-center gap-2 mb-4">
                  <code className="flex-1 text-center text-2xl font-mono tracking-widest
                    bg-slate-900 border border-slate-600 rounded-lg py-3 text-indigo-300">
                    {generatedCode}
                  </code>
                  <button onClick={copyCode} className="btn-secondary">
                    {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                  </button>
                </div>
                <button onClick={onClose} className="btn-primary w-full">
                  Done
                </button>
              </div>
            )}
          </div>
        )}

        {mode === 'join' && (
          <div>
            <p className="text-sm text-slate-400 mb-4">
              Enter the invite code from your friend to join their pool.
            </p>
            <input
              className="input mb-3 text-center text-lg tracking-widest uppercase font-mono"
              placeholder="ABC-XYZ-123"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              maxLength={12}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            />
            {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => setMode('choose')}
                className="btn-secondary flex-1"
              >
                Back
              </button>
              <button
                onClick={handleJoin}
                className="btn-primary flex-1"
                disabled={loading || !inviteCode.trim()}
              >
                {loading ? 'Joining...' : 'Join Pool'}
              </button>
            </div>
          </div>
        )}

        {mode === 'direct' && (
          <div>
            <p className="text-sm text-slate-400 mb-4">
              Enter the IP address of another GPU Co-op machine on your network.
              Port 50051 is used by default.
            </p>
            <input
              className="input mb-3 font-mono"
              placeholder="192.168.1.42  or  192.168.1.42:50051"
              value={directAddress}
              onChange={(e) => setDirectAddress(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleDirectConnect()}
              autoFocus
            />
            {localAddresses.length > 0 && (
              <div className="mb-3 p-3 rounded-lg bg-slate-900/50 border border-slate-700">
                <div className="text-xs text-slate-400 mb-1">
                  Your LAN IP (share this with the other machine):
                </div>
                <div className="font-mono text-sm text-sky-300">
                  {localAddresses.map((a) => `${a}:50051`).join('  •  ')}
                </div>
              </div>
            )}
            <p className="text-xs text-slate-500 mb-3">
              Tip: both machines must have the app running. The first connection
              may trigger a firewall prompt — allow incoming connections.
            </p>
            {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
            {success && <p className="text-green-400 text-sm mb-3">{success}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => setMode('choose')}
                className="btn-secondary flex-1"
              >
                Back
              </button>
              <button
                onClick={handleDirectConnect}
                className="btn-primary flex-1"
                disabled={loading || !directAddress.trim()}
              >
                {loading ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </div>
        )}

        {error && mode === 'create' && (
          <p className="text-red-400 text-sm mt-3">{error}</p>
        )}
      </div>
    </div>
  );
}
