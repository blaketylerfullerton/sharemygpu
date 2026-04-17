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
      const result = await invoke<{ groupId: string; inviteCode: string }>(IPC.GROUP_CREATE);
      if (result?.inviteCode) {
        setGeneratedCode(result.inviteCode);
        const group = await invoke<Group>(IPC.GROUP_GET);
        if (group) setGroup(group);
      }
    } catch {
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
    } catch {
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
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
      }}
    >
      <div
        style={{
          width: '100%', maxWidth: 360, margin: '0 16px',
          background: '#09090b',
          border: '1px solid #27272a',
          borderRadius: 12,
          padding: 20,
          position: 'relative',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#fafafa' }}>
            {mode === 'direct' ? 'Connect on LAN' : 'Add a Friend'}
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#52525b', padding: 4, display: 'flex', alignItems: 'center',
              borderRadius: 6, transition: 'color 0.12s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#a1a1aa')}
            onMouseLeave={e => (e.currentTarget.style.color = '#52525b')}
          >
            <X size={15} />
          </button>
        </div>

        {/* ── choose ── */}
        {mode === 'choose' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                onClick={() => { setMode('create'); handleCreate(); }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                  padding: '16px 12px', borderRadius: 10,
                  background: '#18181b', border: '1px solid #27272a',
                  cursor: 'pointer', transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#3f3f46')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#27272a')}
              >
                <Users size={22} color="#71717a" />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#fafafa', fontFamily: 'inherit' }}>Create Group</div>
                  <div style={{ fontSize: 10, color: '#52525b', marginTop: 2, fontFamily: 'Geist Mono, ui-monospace, monospace' }}>start a new pool</div>
                </div>
              </button>
              <button
                onClick={() => setMode('join')}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                  padding: '16px 12px', borderRadius: 10,
                  background: '#18181b', border: '1px solid #27272a',
                  cursor: 'pointer', transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#3f3f46')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#27272a')}
              >
                <LogIn size={22} color="#71717a" />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#fafafa', fontFamily: 'inherit' }}>Join Group</div>
                  <div style={{ fontSize: 10, color: '#52525b', marginTop: 2, fontFamily: 'Geist Mono, ui-monospace, monospace' }}>enter invite code</div>
                </div>
              </button>
            </div>
            <button
              onClick={() => setMode('direct')}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', borderRadius: 10,
                background: '#18181b', border: '1px solid #27272a',
                cursor: 'pointer', transition: 'border-color 0.15s', width: '100%',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#3f3f46')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#27272a')}
            >
              <Wifi size={18} color="#71717a" />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#fafafa', fontFamily: 'inherit' }}>Connect on LAN</div>
                <div style={{ fontSize: 10, color: '#52525b', marginTop: 2, fontFamily: 'Geist Mono, ui-monospace, monospace' }}>
                  enter another machine's IP directly
                </div>
              </div>
            </button>
          </div>
        )}

        {/* ── create ── */}
        {mode === 'create' && (
          <div>
            {loading && !generatedCode && (
              <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 12, color: '#71717a', fontFamily: 'Geist Mono, ui-monospace, monospace' }}>
                Creating group...
              </div>
            )}
            {generatedCode && (
              <div>
                <p style={{ fontSize: 12, color: '#71717a', marginBottom: 14, lineHeight: 1.5 }}>
                  Share this code with friends. It expires in 24 hours.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <code
                    style={{
                      flex: 1, textAlign: 'center',
                      fontSize: 20, letterSpacing: '0.2em',
                      fontFamily: 'Geist Mono, ui-monospace, monospace',
                      padding: '12px 0', borderRadius: 8,
                      background: '#18181b', border: '1px solid #27272a',
                      color: '#fafafa', display: 'block',
                    }}
                  >
                    {generatedCode}
                  </code>
                  <button
                    onClick={copyCode}
                    style={{
                      padding: '10px 12px', borderRadius: 8,
                      background: '#18181b', border: '1px solid #27272a',
                      color: copied ? '#4ade80' : '#a1a1aa',
                      cursor: 'pointer', display: 'flex', alignItems: 'center',
                      transition: 'color 0.15s', flexShrink: 0,
                    }}
                  >
                    {copied ? <Check size={15} /> : <Copy size={15} />}
                  </button>
                </div>
                <button
                  onClick={onClose}
                  style={{
                    width: '100%', padding: '9px 0', borderRadius: 8,
                    background: '#fafafa', border: 'none', color: '#09090b',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Done
                </button>
              </div>
            )}
            {error && <p style={{ fontSize: 12, color: '#f87171', marginTop: 12 }}>{error}</p>}
          </div>
        )}

        {/* ── join ── */}
        {mode === 'join' && (
          <div>
            <p style={{ fontSize: 12, color: '#71717a', marginBottom: 14, lineHeight: 1.5 }}>
              Enter the invite code from your friend to join their pool.
            </p>
            <input
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '10px 12px', borderRadius: 8, marginBottom: 10,
                background: '#18181b', border: '1px solid #27272a',
                color: '#fafafa', fontSize: 16, letterSpacing: '0.18em',
                textAlign: 'center', textTransform: 'uppercase',
                fontFamily: 'Geist Mono, ui-monospace, monospace',
                outline: 'none',
              }}
              placeholder="ABC-XYZ-123"
              value={inviteCode}
              onChange={e => setInviteCode(e.target.value)}
              maxLength={12}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
            />
            {error && <p style={{ fontSize: 12, color: '#f87171', marginBottom: 10 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setMode('choose')}
                style={{
                  flex: 1, padding: '9px 0', borderRadius: 8,
                  background: 'transparent', border: '1px solid #27272a',
                  color: '#a1a1aa', fontSize: 13, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Back
              </button>
              <button
                onClick={handleJoin}
                disabled={loading || !inviteCode.trim()}
                style={{
                  flex: 1, padding: '9px 0', borderRadius: 8,
                  background: '#fafafa', border: 'none', color: '#09090b',
                  fontSize: 13, fontWeight: 600, cursor: loading || !inviteCode.trim() ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', opacity: loading || !inviteCode.trim() ? 0.4 : 1,
                }}
              >
                {loading ? 'Joining...' : 'Join Pool'}
              </button>
            </div>
          </div>
        )}

        {/* ── direct ── */}
        {mode === 'direct' && (
          <div>
            <p style={{ fontSize: 12, color: '#71717a', marginBottom: 14, lineHeight: 1.5 }}>
              Enter the IP address of another GPU Co-op machine on your network.
            </p>
            <input
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '10px 12px', borderRadius: 8, marginBottom: 10,
                background: '#18181b', border: '1px solid #27272a',
                color: '#fafafa', fontSize: 13,
                fontFamily: 'Geist Mono, ui-monospace, monospace',
                outline: 'none',
              }}
              placeholder="192.168.1.42  or  192.168.1.42:50051"
              value={directAddress}
              onChange={e => setDirectAddress(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleDirectConnect()}
              autoFocus
            />
            {localAddresses.length > 0 && (
              <div
                style={{
                  marginBottom: 10, padding: '10px 12px', borderRadius: 8,
                  background: '#18181b', border: '1px solid #27272a',
                }}
              >
                <div style={{ fontSize: 10, color: '#52525b', marginBottom: 6, fontFamily: 'Geist Mono, ui-monospace, monospace' }}>
                  YOUR LAN IP (share with the other machine):
                </div>
                <div style={{ fontSize: 12, color: '#a1a1aa', fontFamily: 'Geist Mono, ui-monospace, monospace' }}>
                  {localAddresses.map(a => `${a}:50051`).join('  ·  ')}
                </div>
              </div>
            )}
            <p style={{ fontSize: 10, color: '#52525b', marginBottom: 12, fontFamily: 'Geist Mono, ui-monospace, monospace', lineHeight: 1.5 }}>
              Both machines must have the app running. Allow incoming connections if prompted.
            </p>
            {error && (
              <div
                style={{
                  marginBottom: 12, padding: '10px 12px', borderRadius: 8,
                  background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.15)',
                }}
              >
                <p style={{ fontSize: 12, fontWeight: 600, color: '#f87171', marginBottom: 6 }}>{error}</p>
                <ul style={{ fontSize: 10, color: 'rgba(248,113,113,0.6)', fontFamily: 'Geist Mono, ui-monospace, monospace', paddingLeft: 14, lineHeight: 1.7, margin: 0 }}>
                  <li>Both machines must have GPU Co-op running</li>
                  <li>Allow incoming connections if a firewall prompt appears</li>
                  <li>Verify both machines are on the same local network</li>
                </ul>
              </div>
            )}
            {success && <p style={{ fontSize: 12, color: '#4ade80', marginBottom: 12 }}>{success}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setMode('choose')}
                style={{
                  flex: 1, padding: '9px 0', borderRadius: 8,
                  background: 'transparent', border: '1px solid #27272a',
                  color: '#a1a1aa', fontSize: 13, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Back
              </button>
              <button
                onClick={handleDirectConnect}
                disabled={loading || !directAddress.trim()}
                style={{
                  flex: 1, padding: '9px 0', borderRadius: 8,
                  background: '#fafafa', border: 'none', color: '#09090b',
                  fontSize: 13, fontWeight: 600, cursor: loading || !directAddress.trim() ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', opacity: loading || !directAddress.trim() ? 0.4 : 1,
                }}
              >
                {loading ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
