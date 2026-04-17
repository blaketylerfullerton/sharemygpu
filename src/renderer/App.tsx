import React, { useEffect, useState } from 'react';
import { Settings, Plus, Search, Zap } from 'lucide-react';
import { usePeers } from './hooks/usePeers';
import { useJobs } from './hooks/useJobs';
import { useIPC } from './hooks/useIPC';
import { useStore } from './store';
import { IPC } from '../shared/ipc-channels';
import type { AppSettings, Group } from '../shared/types';
import { InviteModal } from './components/InviteModal';

// ── Bootstrap ──────────────────────────────────────────────────
function DaemonBootstrap() {
  const { invoke } = useIPC();
  const { setAppStatus, setSettings, setGroup, setOllamaConnected } = useStore();

  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      try {
        const [status, settings, group, ollama] = await Promise.all([
          invoke<any>(IPC.APP_GET_STATUS).catch(() => null),
          invoke<AppSettings>(IPC.SETTINGS_GET).catch(() => null),
          invoke<Group>(IPC.GROUP_GET).catch(() => null),
          invoke<{ connected: boolean }>(IPC.OLLAMA_STATUS).catch(() => null),
        ]);
        if (cancelled) return;
        if (status)   setAppStatus(status);
        if (settings) setSettings(settings);
        if (group)    setGroup(group);
        if (ollama)   setOllamaConnected(ollama.connected);
      } catch { /* daemon not ready */ }
    };
    bootstrap();
    const iv = setInterval(bootstrap, 5_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [setAppStatus, setSettings, setGroup, setOllamaConnected]);

  usePeers();
  useJobs();
  return null;
}

type ConnState = 'off' | 'connecting' | 'on';

// ── Peer row (ProtonVPN-style) ─────────────────────────────────
function PeerRow({
  peer,
  connState,
  isSelected,
  onConnect,
  onDisconnect,
}: {
  peer: any;
  connState: ConnState;
  isSelected: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const isOffline     = peer.status === 'offline';
  const isBusy        = peer.status === 'busy';
  const isConnecting  = isSelected && connState === 'connecting';
  const isConnected   = isSelected && connState === 'on';

  const dotColor = isOffline ? '#3f3f46' : isBusy ? '#facc15' : '#4ade80';

  // Initials avatar — up to 2 chars from hostname
  const initials = peer.displayName
    ? peer.displayName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase()
    : '?';

  const vram = peer.totalVramMb
    ? `${(peer.totalVramMb / 1024).toFixed(0)} GB`
    : null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '10px 16px',
        gap: 12,
        borderBottom: '1px solid #1c1c1e',
        background: isConnected ? 'rgba(74,222,128,0.04)' : 'transparent',
        transition: 'background 0.2s',
        cursor: isOffline ? 'default' : 'pointer',
        opacity: isOffline ? 0.45 : 1,
      }}
      onClick={() => {
        if (isOffline) return;
        if (isConnected) onDisconnect();
        else onConnect();
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 38, height: 38,
          borderRadius: 10,
          background: isConnected
            ? 'rgba(74,222,128,0.12)'
            : '#1c1c1e',
          border: `1px solid ${isConnected ? 'rgba(74,222,128,0.25)' : '#27272a'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          fontSize: 13,
          fontWeight: 600,
          color: isConnected ? '#4ade80' : '#71717a',
          transition: 'all 0.2s',
          letterSpacing: '-0.01em',
        }}
      >
        {initials}
      </div>

      {/* Name + GPU */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: isConnected ? '#4ade80' : '#fafafa',
            transition: 'color 0.2s',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {peer.displayName}
        </div>
        <div
          style={{
            fontSize: 11,
            color: '#52525b',
            marginTop: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {peer.gpuModel ?? 'CPU only'}{vram ? ` · ${vram}` : ''}
        </div>
      </div>

      {/* Status dot */}
      <span
        style={{
          width: 6, height: 6,
          borderRadius: '50%',
          background: dotColor,
          flexShrink: 0,
          display: 'inline-block',
          transition: 'background 0.2s',
        }}
      />

      {/* Connect button — circular */}
      <button
        onClick={e => {
          e.stopPropagation();
          if (isOffline) return;
          if (isConnected) onDisconnect();
          else onConnect();
        }}
        disabled={isOffline}
        style={{
          width: 30, height: 30,
          borderRadius: '50%',
          border: `1px solid ${isConnected ? 'rgba(74,222,128,0.3)' : '#27272a'}`,
          background: isConnected ? 'rgba(74,222,128,0.08)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: isOffline ? 'not-allowed' : 'pointer',
          flexShrink: 0,
          transition: 'all 0.2s',
        }}
      >
        {isConnecting ? (
          <div
            style={{
              width: 12, height: 12,
              border: '1.5px solid #3f3f46',
              borderTopColor: '#a1a1aa',
              borderRadius: '50%',
              animation: 'spin-ring 0.7s linear infinite',
            }}
          />
        ) : isConnected ? (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#4ade80" strokeWidth="1.8" strokeLinecap="round">
            <path d="M2 5l2 2 4-4" />
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#52525b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 2l4 3-4 3" />
          </svg>
        )}
      </button>
    </div>
  );
}

// ── Connected banner ───────────────────────────────────────────
function ConnectedBanner({ peerName, onDisconnect }: { peerName: string; onDisconnect: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '10px 16px',
        background: 'rgba(74,222,128,0.06)',
        borderBottom: '1px solid rgba(74,222,128,0.12)',
        gap: 10,
        animation: 'fadeUp 0.2s ease both',
      }}
    >
      <span
        style={{
          width: 7, height: 7,
          borderRadius: '50%',
          background: '#4ade80',
          boxShadow: '0 0 0 3px rgba(74,222,128,0.15)',
          flexShrink: 0,
          display: 'inline-block',
        }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#4ade80' }}>
          Connected · {peerName}
        </div>
        <div style={{ fontSize: 11, color: '#52525b', fontFamily: 'Geist Mono, ui-monospace, monospace', marginTop: 1 }}>
          localhost:11434
        </div>
      </div>
      <button
        onClick={onDisconnect}
        style={{
          padding: '4px 10px',
          borderRadius: 6,
          border: '1px solid #3f1e1e',
          background: 'transparent',
          color: '#f87171',
          fontSize: 11,
          fontWeight: 500,
          cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'background 0.15s',
          flexShrink: 0,
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(248,113,113,0.06)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        Disconnect
      </button>
    </div>
  );
}

// ── Settings panel ─────────────────────────────────────────────
function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { appStatus, ollamaConnected } = useStore();
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: '#09090b', display: 'flex', flexDirection: 'column' }}>
      <div
        className="titlebar-drag"
        style={{ display: 'flex', alignItems: 'center', padding: '11px 16px 11px 80px', borderBottom: '1px solid #27272a', gap: 10 }}
      >
        <button
          onClick={onClose}
          className="titlebar-no-drag"
          style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, padding: 0 }}
        >
          ← Back
        </button>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#fafafa' }}>Settings</span>
      </div>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={{ fontSize: 11, color: '#71717a', fontWeight: 500, marginBottom: 4 }}>Status</p>
        <div style={{ border: '1px solid #27272a', borderRadius: 8, overflow: 'hidden' }}>
          {[
            { label: 'Daemon',  ok: appStatus.daemonRunning, desc: appStatus.daemonRunning ? 'Running' : 'Stopped' },
            { label: 'Ollama',  ok: ollamaConnected,         desc: ollamaConnected ? 'localhost:11434' : 'Not detected' },
            { label: 'Network', ok: appStatus.peersOnline > 0, desc: `${appStatus.peersOnline} peer${appStatus.peersOnline === 1 ? '' : 's'} reachable` },
          ].map(({ label, ok, desc }, i) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: i < 2 ? '1px solid #27272a' : 'none' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: ok ? '#4ade80' : '#3f3f46', flexShrink: 0, display: 'inline-block' }} />
              <span style={{ fontSize: 13, flex: 1, color: '#fafafa' }}>{label}</span>
              <span style={{ fontSize: 11, color: '#71717a' }}>{desc}</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11, color: '#71717a', fontWeight: 500, marginTop: 8, marginBottom: 4 }}>About</p>
        <div style={{ border: '1px solid #27272a', borderRadius: 8, overflow: 'hidden' }}>
          {[
            { label: 'Version',  val: '0.1.0' },
            { label: 'Protocol', val: 'SSH tunnel' },
          ].map(({ label, val }, i) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: i < 1 ? '1px solid #27272a' : 'none' }}>
              <span style={{ fontSize: 13, color: '#fafafa' }}>{label}</span>
              <span style={{ fontSize: 12, color: '#71717a', fontFamily: 'Geist Mono, ui-monospace, monospace' }}>{val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main app ───────────────────────────────────────────────────
export default function App() {
  const { peers } = useStore();
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null);
  const [connState,      setConnState]      = useState<ConnState>('off');
  const [query,          setQuery]          = useState('');
  const [showInvite,     setShowInvite]     = useState(false);
  const [showSettings,   setShowSettings]   = useState(false);

  const remotePeers  = peers.filter(p => !p.isLocal);
  const selectedPeer = peers.find(p => p.peerId === selectedPeerId);

  // Auto-select the only peer
  useEffect(() => {
    if (remotePeers.length === 1 && !selectedPeerId) {
      setSelectedPeerId(remotePeers[0].peerId);
    }
    if (selectedPeerId && !remotePeers.find(p => p.peerId === selectedPeerId)) {
      setSelectedPeerId(null);
      setConnState('off');
    }
  }, [remotePeers, selectedPeerId]);

  const filteredPeers = query.trim()
    ? remotePeers.filter(p =>
        p.displayName.toLowerCase().includes(query.toLowerCase()) ||
        (p.gpuModel ?? '').toLowerCase().includes(query.toLowerCase())
      )
    : remotePeers;

  const handleConnect = (peerId: string) => {
    setSelectedPeerId(peerId);
    setConnState('connecting');
    // TODO: invoke IPC tunnel start
    setTimeout(() => setConnState('on'), 1800);
  };

  const handleDisconnect = () => {
    setConnState('off');
  };

  return (
    <div
      style={{
        width: '100%', height: '100vh',
        background: '#09090b',
        display: 'flex', flexDirection: 'column',
        maxWidth: 440, margin: '0 auto',
        borderLeft: '1px solid #27272a',
        borderRight: '1px solid #27272a',
        position: 'relative', overflow: 'hidden',
      }}
    >
      <DaemonBootstrap />

      {/* ── Titlebar ── */}
      <div
        className="titlebar-drag"
        style={{ display: 'flex', alignItems: 'center', padding: '11px 16px', borderBottom: '1px solid #27272a', flexShrink: 0 }}
      >
        <div className="titlebar-no-drag" style={{ display: 'flex', gap: 6 }}>
          {['#ff5f57', '#febc2e', '#28c840'].map((c, i) => (
            <div key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: c }} />
          ))}
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#fafafa', letterSpacing: '-0.01em', marginLeft: 12 }}>
          GPU Co-op
        </span>
        <button
          onClick={() => setShowSettings(true)}
          className="titlebar-no-drag"
          style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#52525b', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center', transition: 'color 0.12s' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#a1a1aa')}
          onMouseLeave={e => (e.currentTarget.style.color = '#52525b')}
        >
          <Settings size={15} />
        </button>
      </div>

      {/* ── Connected banner ── */}
      {connState === 'on' && selectedPeer && (
        <ConnectedBanner
          peerName={selectedPeer.displayName}
          onDisconnect={handleDisconnect}
        />
      )}

      {/* ── Search ── */}
      <div style={{ padding: '12px 16px 0', flexShrink: 0 }}>
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#18181b',
            border: '1px solid #27272a',
            borderRadius: 8,
            padding: '8px 12px',
          }}
        >
          <Search size={13} color="#52525b" style={{ flexShrink: 0 }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search friends"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontSize: 13, color: '#fafafa',
              fontFamily: 'Geist, system-ui, sans-serif',
            }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#52525b', padding: 0, display: 'flex', alignItems: 'center' }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M2 2l8 8M10 2l-8 8" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── List header ── */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px 6px',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 500, color: '#52525b' }}>
          {query ? `${filteredPeers.length} result${filteredPeers.length === 1 ? '' : 's'}` : `Friends (${remotePeers.length})`}
        </span>
        {connState !== 'on' && remotePeers.length > 0 && (
          <span style={{ fontSize: 11, color: '#3f3f46' }}>
            {remotePeers.filter(p => p.status !== 'offline').length} online
          </span>
        )}
      </div>

      {/* ── Peer list ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filteredPeers.length > 0 ? (
          filteredPeers.map(peer => (
            <PeerRow
              key={peer.peerId}
              peer={peer}
              connState={connState}
              isSelected={selectedPeerId === peer.peerId}
              onConnect={() => handleConnect(peer.peerId)}
              onDisconnect={handleDisconnect}
            />
          ))
        ) : (
          /* Empty state */
          <div
            style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              height: '100%', padding: '0 32px',
              textAlign: 'center', gap: 12,
            }}
          >
            <div
              style={{
                width: 44, height: 44,
                borderRadius: 12,
                background: '#18181b',
                border: '1px solid #27272a',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Zap size={18} color="#3f3f46" />
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#fafafa', marginBottom: 4 }}>
                {query ? 'No matches' : 'No friends yet'}
              </p>
              <p style={{ fontSize: 12, color: '#52525b', lineHeight: 1.5 }}>
                {query
                  ? `Nothing found for "${query}"`
                  : 'Invite a friend to share their GPU with you.'}
              </p>
            </div>
            {!query && (
              <button
                onClick={() => setShowInvite(true)}
                className="btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 4 }}
              >
                <Plus size={13} /> Invite a friend
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Bottom bar ── */}
      {remotePeers.length > 0 && (
        <div style={{ padding: '10px 16px', borderTop: '1px solid #1c1c1e', flexShrink: 0 }}>
          <button
            onClick={() => setShowInvite(true)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 8,
              border: '1px dashed #27272a', background: 'transparent',
              color: '#52525b', fontSize: 12, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#3f3f46'; e.currentTarget.style.color = '#a1a1aa'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#27272a'; e.currentTarget.style.color = '#52525b'; }}
          >
            <Plus size={13} /> Invite a friend
          </button>
        </div>
      )}

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      {showInvite   && <InviteModal onClose={() => setShowInvite(false)} />}
    </div>
  );
}
