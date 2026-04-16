import React, { useEffect, useState } from 'react';
import { X, Copy, Check, Users, LogIn, Wifi } from 'lucide-react';
import { useIPC } from '../hooks/useIPC';
import { IPC } from '../../shared/ipc-channels';
import { useStore } from '../store';
import type { Group } from '../../shared/types';

interface Props {
  onClose: () => void;
}

function parseConnectError(raw: string): string {
  if (raw.includes('DEADLINE_EXCEEDED') || raw.includes('timed out')) {
    return 'Connection timed out — the remote machine may not be running GPU Co-op, or a firewall is blocking the connection.';
  }
  if (raw.includes('ECONNREFUSED') || raw.includes('Connection refused')) {
    return 'Connection refused — the machine is reachable but GPU Co-op doesn\'t appear to be listening on that port.';
  }
  if (raw.includes('EHOSTUNREACH') || raw.includes('unreachable')) {
    return 'Host unreachable — check that both machines are on the same network.';
  }
  if (raw.includes('Cannot connect to yourself')) {
    return 'That\'s your own address! Enter the other machine\'s IP.';
  }
  const cleaned = raw.replace(/^(Error:\s*)+/i, '').trim();
  return cleaned || 'Connection failed — check the address and try again.';
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
      const raw = e instanceof Error ? e.message : String(e);
      setError(parseConnectError(raw));
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
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(6, 8, 13, 0.8)', backdropFilter: 'blur(8px)' }}>
      <div
        className="w-full max-w-md mx-4 rounded-xl p-6 relative animate-fade-up"
        style={{
          background: '#161b22',
          border: '1px solid #21262d',
          boxShadow: '0 24px 80px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Accent line at top */}
        <div
          className="absolute top-0 left-6 right-6 h-[1px]"
          style={{ background: 'linear-gradient(90deg, transparent, #58e6d9, transparent)' }}
        />

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="page-title text-lg">
            {mode === 'direct' ? 'Connect on LAN' : 'Join a Pool'}
          </h2>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {mode === 'choose' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setMode('create'); handleCreate(); }}
                className="flex flex-col items-center gap-3 p-5 rounded-xl transition-all duration-200"
                style={{ background: '#1c2128', border: '1px solid #21262d' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#58e6d9'; e.currentTarget.style.boxShadow = '0 0 20px rgba(88, 230, 217, 0.06)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#21262d'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <Users size={28} style={{ color: '#58e6d9' }} />
                <div className="text-center">
                  <div className="font-display font-semibold text-sm" style={{ color: '#e6edf3' }}>Create Group</div>
                  <div className="font-mono text-[10px] mt-0.5" style={{ color: '#484f58' }}>start a new pool</div>
                </div>
              </button>
              <button
                onClick={() => setMode('join')}
                className="flex flex-col items-center gap-3 p-5 rounded-xl transition-all duration-200"
                style={{ background: '#1c2128', border: '1px solid #21262d' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#39d353'; e.currentTarget.style.boxShadow = '0 0 20px rgba(57, 211, 83, 0.06)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#21262d'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <LogIn size={28} style={{ color: '#39d353' }} />
                <div className="text-center">
                  <div className="font-display font-semibold text-sm" style={{ color: '#e6edf3' }}>Join Group</div>
                  <div className="font-mono text-[10px] mt-0.5" style={{ color: '#484f58' }}>enter invite code</div>
                </div>
              </button>
            </div>
            <button
              onClick={() => setMode('direct')}
              className="flex items-center gap-3 w-full p-4 rounded-xl transition-all duration-200"
              style={{ background: '#1c2128', border: '1px solid #21262d' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#58a6ff'; e.currentTarget.style.boxShadow = '0 0 20px rgba(88, 166, 255, 0.06)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#21262d'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <Wifi size={22} style={{ color: '#58a6ff' }} />
              <div className="text-left">
                <div className="font-display font-semibold text-sm" style={{ color: '#e6edf3' }}>Connect on LAN</div>
                <div className="font-mono text-[10px] mt-0.5" style={{ color: '#484f58' }}>
                  enter another machine's IP directly
                </div>
              </div>
            </button>
          </div>
        )}

        {mode === 'create' && (
          <div>
            {loading && !generatedCode && (
              <div className="text-center py-8 font-mono text-sm" style={{ color: '#7d8590' }}>
                Creating group...
              </div>
            )}
            {generatedCode && (
              <div>
                <p className="text-sm mb-4" style={{ color: '#7d8590' }}>
                  Share this code with friends. It expires in 24 hours.
                </p>
                <div className="flex items-center gap-2 mb-5">
                  <code
                    className="flex-1 text-center text-2xl font-mono tracking-[0.25em] py-3 rounded-lg"
                    style={{ background: '#0d1117', border: '1px solid #21262d', color: '#58e6d9' }}
                  >
                    {generatedCode}
                  </code>
                  <button onClick={copyCode} className="btn-secondary">
                    {copied ? <Check size={16} style={{ color: '#39d353' }} /> : <Copy size={16} />}
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
            <p className="text-sm mb-4" style={{ color: '#7d8590' }}>
              Enter the invite code from your friend to join their pool.
            </p>
            <input
              className="input mb-3 text-center text-lg tracking-[0.2em] uppercase font-mono"
              placeholder="ABC-XYZ-123"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              maxLength={12}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            />
            {error && <p className="text-sm mb-3" style={{ color: '#f85149' }}>{error}</p>}
            <div className="flex gap-2">
              <button onClick={() => setMode('choose')} className="btn-secondary flex-1">
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
            <p className="text-sm mb-4" style={{ color: '#7d8590' }}>
              Enter the IP address of another GPU Co-op machine on your network.
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
              <div
                className="mb-3 p-3 rounded-lg"
                style={{ background: '#0d1117', border: '1px solid #21262d' }}
              >
                <div className="font-mono text-[10px] mb-1.5" style={{ color: '#484f58' }}>
                  YOUR LAN IP (share with the other machine):
                </div>
                <div className="font-mono text-sm" style={{ color: '#58a6ff' }}>
                  {localAddresses.map((a) => `${a}:50051`).join('  •  ')}
                </div>
              </div>
            )}
            <p className="font-mono text-[10px] mb-3" style={{ color: '#484f58' }}>
              Both machines must have the app running. Allow incoming connections if prompted.
            </p>
            {error && (
              <div
                className="mb-3 p-3 rounded-lg"
                style={{ background: 'rgba(248, 81, 73, 0.06)', border: '1px solid rgba(248, 81, 73, 0.15)' }}
              >
                <p className="text-sm font-semibold mb-1.5" style={{ color: '#f85149' }}>{error}</p>
                <ul className="font-mono text-[10px] space-y-0.5 list-disc list-inside" style={{ color: 'rgba(248, 81, 73, 0.7)' }}>
                  <li>Both machines must have GPU Co-op running</li>
                  <li>Allow incoming connections if a firewall prompt appears</li>
                  <li>Verify both machines are on the same local network</li>
                </ul>
              </div>
            )}
            {success && <p className="text-sm mb-3" style={{ color: '#39d353' }}>{success}</p>}
            <div className="flex gap-2">
              <button onClick={() => setMode('choose')} className="btn-secondary flex-1">
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
          <p className="text-sm mt-3" style={{ color: '#f85149' }}>{error}</p>
        )}
      </div>
    </div>
  );
}
