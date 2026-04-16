import React, { useState } from 'react';
import { Plus, Cpu, HardDrive, Monitor, Zap } from 'lucide-react';
import { useStore } from '../store';
import { usePeers } from '../hooks/usePeers';
import { PeerCard } from '../components/PeerCard';
import { InviteModal } from '../components/InviteModal';

function formatGB(mb: number | undefined): string {
  if (!mb) return '—';
  return `${(mb / 1024).toFixed(0)} GB`;
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Pool Overview</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {group ? group.groupName ?? 'Your co-op pool' : 'No pool joined'}
          </p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="btn-primary"
        >
          <Plus size={16} />
          Invite Friend
        </button>
      </div>

      {/* Pool stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card text-center">
          <div className="text-2xl font-bold text-green-400">{onlinePeers.length}</div>
          <div className="text-xs text-slate-400 mt-1">Online Machines</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-indigo-400">{formatGB(totalVram)}</div>
          <div className="text-xs text-slate-400 mt-1">Total VRAM</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-blue-400">{formatGB(availableVram)}</div>
          <div className="text-xs text-slate-400 mt-1">Available VRAM</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-yellow-400">{totalCores}</div>
          <div className="text-xs text-slate-400 mt-1">Total CPU Cores</div>
        </div>
      </div>

      {/* Peer grid */}
      {peers.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-slate-500 mb-4">
            <Monitor size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">No machines in pool</p>
            <p className="text-sm mt-1">
              Create or join a group to start sharing GPUs with friends.
            </p>
          </div>
          <button onClick={() => setShowInvite(true)} className="btn-primary">
            <Plus size={16} /> Get Started
          </button>
        </div>
      ) : (
        <div>
          <h2 className="section-title">Machines</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {peers.map((peer) => (
              <PeerCard
                key={peer.peerId}
                peer={peer}
                resource={peerResources.get(peer.peerId) ?? localResource ?? undefined}
              />
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
