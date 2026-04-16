import React from 'react';

interface Props {
  label: string;
  used: number;
  total: number;
  unit?: string;
  color?: 'accent' | 'green' | 'amber' | 'red';
}

const FILLS: Record<string, string> = {
  accent: '#58e6d9',
  green: '#39d353',
  amber: '#e3b341',
  red: '#f85149',
};

const GLOWS: Record<string, string> = {
  accent: 'rgba(88, 230, 217, 0.25)',
  green: 'rgba(57, 211, 83, 0.25)',
  amber: 'rgba(227, 179, 65, 0.25)',
  red: 'rgba(248, 81, 73, 0.25)',
};

function formatBytes(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

export function ResourceBar({ label, used, total, unit, color = 'accent' }: Props) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;

  const effectiveColor = pct > 85 ? 'red' : pct > 65 ? 'amber' : color;
  const fill = FILLS[effectiveColor];
  const glow = GLOWS[effectiveColor];

  const fmtUsed = unit === 'MB' ? formatBytes(used) : `${used}${unit ?? ''}`;
  const fmtTotal = unit === 'MB' ? formatBytes(total) : `${total}${unit ?? ''}`;

  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <span className="font-mono text-[9px] uppercase tracking-[0.1em]" style={{ color: '#484f58' }}>
          {label}
        </span>
        <span className="font-mono text-[10px]" style={{ color: '#7d8590' }}>
          {fmtUsed} / {fmtTotal}
          <span style={{ color: '#484f58', marginLeft: 4 }}>{pct}%</span>
        </span>
      </div>
      <div className="w-full rounded-full h-[3px]" style={{ background: '#21262d' }}>
        <div
          className="h-[3px] rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${pct}%`,
            background: fill,
            boxShadow: pct > 0 ? `0 0 8px ${glow}` : 'none',
          }}
        />
      </div>
    </div>
  );
}
