import React from 'react';
import type { PeerStatus } from '../../shared/types';

interface Props {
  status: PeerStatus;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const COLORS: Record<PeerStatus, string> = {
  online: 'bg-green-400',
  idle: 'bg-green-400',
  busy: 'bg-yellow-400',
  offline: 'bg-slate-500',
};

const LABELS: Record<PeerStatus, string> = {
  online: 'Online',
  idle: 'Idle',
  busy: 'Busy',
  offline: 'Offline',
};

const SIZES = {
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
};

export function StatusIndicator({ status, size = 'md', showLabel }: Props) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-block rounded-full ${SIZES[size]} ${COLORS[status]} ${
          status !== 'offline' ? 'animate-pulse' : ''
        }`}
      />
      {showLabel && (
        <span className="text-xs text-slate-400">{LABELS[status]}</span>
      )}
    </span>
  );
}
