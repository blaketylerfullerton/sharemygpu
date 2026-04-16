import React, { useState } from 'react';
import { Plus, Hexagon } from 'lucide-react';
import { useStore } from '../store';
import { usePeers } from '../hooks/usePeers';
import { PeerCard } from '../components/PeerCard';
import { InviteModal } from '../components/InviteModal';

function formatGB(mb: number | undefined): string {
  if (!mb) return '—';
  return `${(mb / 1024).toFixed(0)} GB`;
}

interface StatCardProps {
  value: string;
  label: string;
  color: string;
  glow: string;
  delay: number;
}

function StatCard({ value, label, color, glow, delay }: StatCardProps) {
  return (
    <div
      className="card card-glow animate-fade-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className="text-3xl font-display font-bold"
        style={{ color, textShadow: `0 0 20px ${glow}` }}
      >
        {value}
      </div>
      <div className="font-mono text-[9px] tracking-[0.14em] mt-2 uppercase" style={{ color: '#484f58' }}>
        {label}
      </div>
    </div>
  );
}

export function PoolOverview() {
  const { peers, peerResources, localResource, group } = useStore();
  const { refresh } = usePeers();
  const [showInvite, setShowInvite] = useState(false);

  const onlinePeers = peers.filter((p) => p.status !== 'offline');
  const totalVram = peers.reduce((sum, p) => sum + (p.totalVramMb ?? 0), 0);
  const availableVram = Array.from(peerResources.values()).reduce(
    (sum, r) => sum + r.availableVramMb,
    0
  );
  const totalCores = peers.reduce((sum, p) => sum + (p.totalCpuCores ?? 0), 0);

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="page-title">Pool Overview</h1>
          <p className="page-sub">
            {group ? group.groupName ?? 'your co-op mesh' : 'no pool joined'}
          </p>
        </div>
        <button onClick={() => setShowInvite(true)} className="btn-primary">
          <Plus size={16} />
          Invite Friend
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          value={String(onlinePeers.length)}
          label="Machines Online"
          color="#39d353"
          glow="rgba(57, 211, 83, 0.15)"
          delay={60}
        />
        <StatCard
          value={formatGB(totalVram)}
          label="Total VRAM"
          color="#58e6d9"
          glow="rgba(88, 230, 217, 0.15)"
          delay={120}
        />
        <StatCard
          value={formatGB(availableVram)}
          label="Available VRAM"
          color="#58a6ff"
          glow="rgba(88, 166, 255, 0.15)"
          delay={180}
        />
        <StatCard
          value={String(totalCores)}
          label="CPU Cores"
          color="#e3b341"
          glow="rgba(227, 179, 65, 0.15)"
          delay={240}
        />
      </div>

      {/* Peer grid */}
      {peers.length === 0 ? (
        <div className="card text-center py-16 animate-fade-up" style={{ animationDelay: '300ms' }}>
          <Hexagon
            size={48}
            className="mx-auto mb-4"
            strokeWidth={1}
            style={{ color: '#21262d' }}
          />
          <p className="font-display text-lg font-semibold" style={{ color: '#7d8590' }}>
            No machines in pool
          </p>
          <p className="text-sm mt-2 max-w-xs mx-auto" style={{ color: '#484f58' }}>
            Create or join a group to start sharing compute with friends.
          </p>
          <button onClick={() => setShowInvite(true)} className="btn-primary mt-6">
            <Plus size={16} /> Get Started
          </button>
        </div>
      ) : (
        <div>
          <div className="section-title">Machines</div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {peers.map((peer, i) => (
              <div
                key={peer.peerId}
                className="animate-fade-up"
                style={{ animationDelay: `${300 + i * 60}ms` }}
              >
                <PeerCard
                  peer={peer}
                  resource={peerResources.get(peer.peerId) ?? localResource ?? undefined}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {showInvite && (
        <InviteModal
          onClose={() => {
            setShowInvite(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}
