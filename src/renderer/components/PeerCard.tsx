import React from 'react';
import { Cpu, HardDrive, Monitor, Wifi, WifiOff } from 'lucide-react';
import type { Peer, ResourceStatus } from '../../shared/types';
import { StatusIndicator } from './StatusIndicator';
import { ResourceBar } from './ResourceBar';

interface Props {
  peer: Peer;
  resource?: ResourceStatus;
}

function formatGB(mb: number | undefined): string {
  if (!mb) return '—';
  return `${(mb / 1024).toFixed(0)} GB`;
}

export function PeerCard({ peer, resource }: Props) {
  const isOffline = peer.status === 'offline';

  return (
    <div className={`card transition-opacity ${isOffline ? 'opacity-50' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <StatusIndicator status={peer.status} size="md" />
          <div>
            <div className="font-medium text-slate-100">
              {peer.displayName}
              {peer.isLocal && (
                <span className="ml-2 badge badge-blue">You</span>
              )}
            </div>
            <div className="text-xs text-slate-500">
              {peer.isLocal ? 'Local machine' : peer.endpoint ?? 'P2P'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          {isOffline ? (
            <WifiOff size={12} className="text-slate-500" />
          ) : (
            <Wifi size={12} className="text-green-400" />
          )}
          <span className="capitalize">{peer.status}</span>
        </div>
      </div>

      {/* Hardware info */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Monitor size={12} />
          <span className="truncate">{peer.gpuModel ?? '—'}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <HardDrive size={12} />
          <span>{formatGB(peer.totalVramMb)} VRAM</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Cpu size={12} />
          <span>{peer.totalCpuCores ?? '—'} cores</span>
        </div>
      </div>

      {/* Resource bars (live) */}
      {resource && !isOffline && (
        <div className="space-y-2">
          <ResourceBar
            label="VRAM"
            used={resource.totalVramMb - resource.availableVramMb}
            total={resource.totalVramMb}
            unit="MB"
          />
          <ResourceBar
            label="RAM"
            used={resource.totalRamMb - resource.availableRamMb}
            total={resource.totalRamMb}
            unit="MB"
            color="green"
          />
          {resource.gpuUtilizationPct !== undefined && (
            <ResourceBar
              label="GPU"
              used={resource.gpuUtilizationPct}
              total={100}
              unit="%"
              color="yellow"
            />
          )}
        </div>
      )}

      {isOffline && (
        <div className="text-xs text-slate-500 text-center py-1">
          Last seen:{' '}
          {peer.lastSeenAt
            ? new Date(peer.lastSeenAt).toLocaleString()
            : 'never'}
        </div>
      )}
    </div>
  );
}
