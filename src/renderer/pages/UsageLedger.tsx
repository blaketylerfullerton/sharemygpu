import React, { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useStore } from '../store';
import { useIPC } from '../hooks/useIPC';
import { IPC } from '../../shared/ipc-channels';
import type { UsageSummary } from '../../shared/types';

function formatHours(secs: number): string {
  const h = secs / 3600;
  if (h < 1) return `${Math.round(secs / 60)}m`;
  return `${h.toFixed(1)}h`;
}

export function UsageLedger() {
  const { invoke } = useIPC();
  const { usageSummary, setUsageSummary } = useStore();
  const [chartData, setChartData] = useState<unknown[]>([]);

  useEffect(() => {
    const load = async () => {
      const summary = await invoke<UsageSummary[]>(IPC.USAGE_SUMMARY);
      if (summary) setUsageSummary(summary);

      const history = await invoke<
        { date: string; contributed: number; consumed: number }[]
      >(IPC.USAGE_HISTORY, 30);
      if (history) setChartData(history);
    };
    load();
  }, [setUsageSummary]);

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="animate-fade-up">
        <h1 className="page-title">Usage Ledger</h1>
        <p className="page-sub">gpu-hours contributed vs consumed — informational only</p>
      </div>

      {/* Per-peer summary */}
      <div className="grid gap-3">
        {usageSummary.length === 0 ? (
          <div className="card text-center py-10 animate-fade-up" style={{ animationDelay: '60ms' }}>
            <p className="font-mono text-sm" style={{ color: '#484f58' }}>
              No usage data yet. Run some jobs to see the ledger.
            </p>
          </div>
        ) : (
          usageSummary.map((entry, i) => {
            const net = entry.netBalance;
            const Icon = net > 0 ? TrendingUp : net < 0 ? TrendingDown : Minus;
            const netColor = net > 0 ? '#39d353' : net < 0 ? '#f85149' : '#7d8590';
            return (
              <div
                key={entry.peerId}
                className="card card-hover animate-fade-up"
                style={{ animationDelay: `${60 + i * 60}ms` }}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="font-display font-semibold text-sm" style={{ color: '#e6edf3' }}>
                    {entry.displayName}
                  </span>
                  <div className="flex items-center gap-1.5 font-mono text-sm font-semibold" style={{ color: netColor }}>
                    <Icon size={14} />
                    <span>
                      {net >= 0 ? '+' : ''}{formatHours(net)} net
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <div className="label mb-1.5">Contributed</div>
                    <div className="text-xl font-display font-bold" style={{ color: '#39d353' }}>
                      {formatHours(entry.gpuSecondsContributed)}
                    </div>
                  </div>
                  <div>
                    <div className="label mb-1.5">Consumed</div>
                    <div className="text-xl font-display font-bold" style={{ color: '#f85149' }}>
                      {formatHours(entry.gpuSecondsConsumed)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="card animate-fade-up" style={{ animationDelay: '300ms' }}>
          <div className="section-title">30-Day History</div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData as Record<string, unknown>[]}>
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#484f58', fontSize: 10, fontFamily: '"JetBrains Mono"' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fill: '#484f58', fontSize: 10, fontFamily: '"JetBrains Mono"' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v}h`}
                />
                <Tooltip
                  contentStyle={{
                    background: '#161b22',
                    border: '1px solid #21262d',
                    borderRadius: 8,
                    color: '#e6edf3',
                    fontFamily: '"JetBrains Mono"',
                    fontSize: 11,
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                  }}
                  formatter={(v: number) => formatHours(v * 3600)}
                  cursor={{ fill: 'rgba(88, 230, 217, 0.03)' }}
                />
                <Legend
                  wrapperStyle={{
                    fontFamily: '"JetBrains Mono"',
                    fontSize: 10,
                    color: '#7d8590',
                  }}
                />
                <Bar
                  dataKey="contributed"
                  name="Contributed"
                  fill="#39d353"
                  radius={[3, 3, 0, 0]}
                  opacity={0.85}
                />
                <Bar
                  dataKey="consumed"
                  name="Consumed"
                  fill="#f85149"
                  radius={[3, 3, 0, 0]}
                  opacity={0.85}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
