import React from 'react';

interface Props {
  label: string;
  used:  number;
  total: number;
  unit?: string;
  color?: 'accent' | 'green' | 'amber' | 'red';
}

const FILLS: Record<string, string> = {
  accent: '#a1a1aa',
  green:  '#4ade80',
  amber:  '#facc15',
  red:    '#f87171',
};

function formatBytes(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

export function ResourceBar({ label, used, total, unit, color = 'accent' }: Props) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;

  const effectiveColor = pct > 85 ? 'red' : pct > 65 ? 'amber' : color;
  const fill           = FILLS[effectiveColor];

  const fmtUsed  = unit === 'MB' ? formatBytes(used)  : `${used}${unit ?? ''}`;
  const fmtTotal = unit === 'MB' ? formatBytes(total) : `${total}${unit ?? ''}`;

  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <span style={{ fontSize: 11, color: '#71717a', fontFamily: 'Geist, system-ui, sans-serif', fontWeight: 500 }}>
          {label}
        </span>
        <span style={{ fontSize: 11, color: '#a1a1aa', fontFamily: 'Geist Mono, ui-monospace, monospace' }}>
          {fmtUsed} / {fmtTotal}
          <span style={{ color: '#52525b', marginLeft: 4 }}>{pct}%</span>
        </span>
      </div>
      <div
        className="w-full rounded-full"
        style={{ height: 3, background: '#27272a' }}
      >
        <div
          style={{
            height:       3,
            borderRadius: 9999,
            width:        `${pct}%`,
            background:   fill,
            transition:   'width 0.7s ease',
          }}
        />
      </div>
    </div>
  );
}
