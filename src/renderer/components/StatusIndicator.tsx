import React from 'react';
import type { PeerStatus } from '../../shared/types';

interface Props {
  status: PeerStatus;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const COLORS: Record<PeerStatus, string> = {
  online: '#39d353',
  idle: '#39d353',
  busy: '#e3b341',
  offline: '#484f58',
};

const LABELS: Record<PeerStatus, string> = {
  online: 'Online',
  idle: 'Idle',
  busy: 'Busy',
  offline: 'Offline',
};

const DOT_SIZES = { sm: 6, md: 8, lg: 10 };

export function StatusIndicator({ status, size = 'md', showLabel }: Props) {
  const isActive = status !== 'offline';
  const color = COLORS[status];
  const dotSize = DOT_SIZES[size];
  const wrapSize = dotSize + 10;

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="relative inline-flex items-center justify-center shrink-0"
        style={{ width: wrapSize, height: wrapSize }}
      >
        {isActive && (
          <span
            className="absolute animate-ping rounded-full"
            style={{
              width: dotSize + 6,
              height: dotSize + 6,
              background: color,
              opacity: 0.15,
            }}
          />
        )}
        <span
          className="relative rounded-full"
          style={{
            width: dotSize,
            height: dotSize,
            background: color,
            boxShadow: isActive ? `0 0 8px ${color}` : 'none',
          }}
        />
      </span>
      {showLabel && (
        <span className="font-mono text-[10px] uppercase" style={{ color: '#7d8590' }}>
          {LABELS[status]}
        </span>
      )}
    </span>
  );
}
