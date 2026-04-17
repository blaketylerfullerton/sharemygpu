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
  delay: number;
}

function StatCard({ value, label, delay }: StatCardProps) {
  return (
    <div
      className="card card-hover animate-fade-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        style={{ fontSize: 28, fontWeight: 600, color: '#fafafa', letterSpacing: '-0.02em', lineHeight: 1 }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11, color: '#71717a', marginTop: 8, fontWeight: 500 }}>
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
        <StatCard value={String(onlinePeers.length)} label="Machines Online"  delay={60} />
        <StatCard value={formatGB(totalVram)}        label="Total VRAM"       delay={120} />
        <StatCard value={formatGB(availableVram)}    label="Available VRAM"   delay={180} />
        <StatCard value={String(totalCores)}         label="CPU Cores"        delay={240} />
      </div>

      {/* Peer grid */}
      {peers.length === 0 ? (
        <div className="card text-center py-16 animate-fade-up" style={{ animationDelay: '300ms' }}>
          <Hexagon
            size={48}
            className="mx-auto mb-4"
            strokeWidth={1}
            style={{ color: '#27272a' }}
          />
          <p className="text-lg font-semibold" style={{ color: '#a1a1aa' }}>
            No machines in pool
          </p>
          <p className="text-sm mt-2 max-w-xs mx-auto" style={{ color: '#71717a' }}>
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
