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
    <div className={`card card-glow transition-all duration-300 ${isOffline ? 'opacity-35' : ''}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <StatusIndicator status={peer.status} size="md" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-sm font-semibold" style={{ color: '#e6edf3' }}>
                {peer.displayName}
              </span>
              {peer.isLocal && <span className="badge badge-blue">LOCAL</span>}
            </div>
            <div className="font-mono text-[10px] mt-0.5" style={{ color: '#484f58' }}>
              {peer.isLocal ? 'this machine' : peer.endpoint ?? 'p2p tunnel'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {isOffline ? (
            <WifiOff size={11} style={{ color: '#484f58' }} />
          ) : (
            <Wifi size={11} style={{ color: '#39d353' }} />
          )}
          <span className="font-mono text-[9px] uppercase tracking-wider" style={{ color: '#7d8590' }}>
            {peer.status}
          </span>
        </div>
      </div>

      {/* Hardware specs strip */}
      <div
        className="flex items-center gap-4 mb-4 py-2 px-3 rounded-lg"
        style={{ background: '#0d1117', border: '1px solid #21262d' }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Monitor size={10} style={{ color: '#484f58', flexShrink: 0 }} />
          <span className="font-mono text-[10px] truncate" style={{ color: '#7d8590' }}>
            {peer.gpuModel ?? '—'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <HardDrive size={10} style={{ color: '#484f58' }} />
          <span className="font-mono text-[10px]" style={{ color: '#7d8590' }}>
            {formatGB(peer.totalVramMb)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Cpu size={10} style={{ color: '#484f58' }} />
          <span className="font-mono text-[10px]" style={{ color: '#7d8590' }}>
            {peer.totalCpuCores ?? '—'}c
          </span>
        </div>
      </div>

      {/* Live resource bars */}
      {resource && !isOffline && (
        <div className="space-y-3">
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
              color="amber"
            />
          )}
        </div>
      )}

      {isOffline && (
        <div className="font-mono text-[10px] text-center py-2" style={{ color: '#484f58' }}>
          last seen:{' '}
          {peer.lastSeenAt
            ? new Date(peer.lastSeenAt).toLocaleString()
            : 'never'}
        </div>
      )}
    </div>
  );
}
