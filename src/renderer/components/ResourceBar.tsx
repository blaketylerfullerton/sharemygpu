import React from 'react';

interface Props {
  label: string;
  used: number;
  total: number;
  unit?: string;
  color?: 'indigo' | 'green' | 'yellow' | 'red';
}

function formatBytes(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

const TRACK_COLORS = {
  indigo: 'bg-indigo-500',
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
};

export function ResourceBar({ label, used, total, unit, color = 'indigo' }: Props) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const barColor =
    pct > 85 ? 'bg-red-500' : pct > 60 ? 'bg-yellow-500' : TRACK_COLORS[color];

  const formattedUsed = unit === 'MB' ? formatBytes(used) : `${used}${unit ?? ''}`;
  const formattedTotal = unit === 'MB' ? formatBytes(total) : `${total}${unit ?? ''}`;

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-slate-400">{label}</span>
        <span className="text-xs text-slate-300">
          {formattedUsed} / {formattedTotal}
          <span className="text-slate-500 ml-1">({pct}%)</span>
        </span>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
