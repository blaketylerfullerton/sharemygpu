import React from 'react';
import type { PeerStatus } from '../../shared/types';

interface Props {
  status: PeerStatus;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const COLORS: Record<PeerStatus, string> = {
  online:  '#4ade80',
  idle:    '#4ade80',
  busy:    '#facc15',
  offline: '#3f3f46',
};

const LABELS: Record<PeerStatus, string> = {
  online:  'Online',
  idle:    'Idle',
  busy:    'Busy',
  offline: 'Offline',
};

const DOT_SIZES = { sm: 6, md: 7, lg: 9 };

export function StatusIndicator({ status, size = 'md', showLabel }: Props) {
  const color   = COLORS[status];
  const dotSize = DOT_SIZES[size];

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        style={{
          width:        dotSize,
          height:       dotSize,
          borderRadius: '50%',
          background:   color,
          display:      'inline-block',
          flexShrink:   0,
        }}
      />
      {showLabel && (
        <span style={{ fontSize: 11, color: '#a1a1aa', fontFamily: 'Geist, system-ui, sans-serif' }}>
          {LABELS[status]}
        </span>
      )}
    </span>
  );
}
