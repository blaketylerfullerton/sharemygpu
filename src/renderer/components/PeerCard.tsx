import React from 'react';
import { Cpu, HardDrive, Monitor, Wifi, WifiOff } from 'lucide-react';
import type { Peer, ResourceStatus } from '../../shared/types';
import { StatusIndicator } from './StatusIndicator';
import { ResourceBar } from './ResourceBar';

interface Props {
  peer:      Peer;
  resource?: ResourceStatus;
}

function formatGB(mb: number | undefined): string {
  if (!mb) return '—';
  return `${(mb / 1024).toFixed(0)} GB`;
}

export function PeerCard({ peer, resource }: Props) {
  const isOffline = peer.status === 'offline';

  return (
    <div
      className={`card card-hover transition-all duration-200 ${isOffline ? 'opacity-40' : ''}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <StatusIndicator status={peer.status} size="md" />
          <div>
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 13, fontWeight: 600, color: '#fafafa' }}>
                {peer.displayName}
              </span>
              {peer.isLocal && <span className="badge-blue">LOCAL</span>}
            </div>
            <div style={{ fontSize: 11, color: '#52525b', marginTop: 2, fontFamily: 'Geist Mono, ui-monospace, monospace' }}>
              {peer.isLocal ? 'this machine' : (peer.endpoint ?? 'p2p tunnel')}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {isOffline
            ? <WifiOff size={11} style={{ color: '#52525b' }} />
            : <Wifi    size={11} style={{ color: '#4ade80' }} />
          }
          <span style={{ fontSize: 11, color: '#71717a', fontFamily: 'Geist, system-ui, sans-serif', fontWeight: 500 }}>
            {peer.status}
          </span>
        </div>
      </div>

      {/* Hardware strip */}
      <div
        className="flex items-center gap-4 mb-4 py-2 px-3 rounded-md"
        style={{ background: '#18181b', border: '1px solid #27272a' }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Monitor size={10} style={{ color: '#52525b', flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: '#a1a1aa', fontFamily: 'Geist Mono, ui-monospace, monospace' }} className="truncate">
            {peer.gpuModel ?? '—'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <HardDrive size={10} style={{ color: '#52525b' }} />
          <span style={{ fontSize: 11, color: '#a1a1aa', fontFamily: 'Geist Mono, ui-monospace, monospace' }}>
            {formatGB(peer.totalVramMb)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Cpu size={10} style={{ color: '#52525b' }} />
          <span style={{ fontSize: 11, color: '#a1a1aa', fontFamily: 'Geist Mono, ui-monospace, monospace' }}>
            {peer.totalCpuCores ?? '—'}c
          </span>
        </div>
      </div>

      {/* Resource bars */}
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
        <div style={{ fontSize: 11, textAlign: 'center', paddingTop: 8, color: '#52525b', fontFamily: 'Geist Mono, ui-monospace, monospace' }}>
          last seen:{' '}
          {peer.lastSeenAt
            ? new Date(peer.lastSeenAt).toLocaleString()
            : 'never'}
        </div>
      )}
    </div>
  );
}
