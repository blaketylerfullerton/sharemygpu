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
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Usage Ledger</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          GPU-hours contributed vs consumed — informational only
        </p>
      </div>

      {/* Per-peer summary */}
      <div className="grid gap-3">
        {usageSummary.length === 0 ? (
          <div className="card text-center py-8 text-slate-500">
            No usage data yet. Run some jobs to see the ledger.
          </div>
        ) : (
          usageSummary.map((entry) => {
            const net = entry.netBalance;
            const Icon =
              net > 0 ? TrendingUp : net < 0 ? TrendingDown : Minus;
            const netColor =
              net > 0
                ? 'text-green-400'
                : net < 0
                ? 'text-red-400'
                : 'text-slate-400';
            return (
              <div key={entry.peerId} className="card">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-medium text-slate-200">
                    {entry.displayName}
                  </div>
                  <div className={`flex items-center gap-1 text-sm font-medium ${netColor}`}>
                    <Icon size={14} />
                    <span>
                      {net >= 0 ? '+' : ''}
                      {formatHours(net)} net
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Contributed</div>
                    <div className="text-lg font-semibold text-green-400">
                      {formatHours(entry.gpuSecondsContributed)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Consumed</div>
                    <div className="text-lg font-semibold text-red-400">
                      {formatHours(entry.gpuSecondsConsumed)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Time-series chart */}
      {chartData.length > 0 && (
        <div className="card">
          <div className="section-title">30-Day History</div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData as Record<string, unknown>[]}>
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v}h`}
                />
                <Tooltip
                  contentStyle={{
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: 8,
                    color: '#f8fafc',
                  }}
                  formatter={(v: number) => formatHours(v * 3600)}
                />
                <Legend />
                <Bar
                  dataKey="contributed"
                  name="Contributed"
                  fill="#22c55e"
                  radius={[3, 3, 0, 0]}
                />
                <Bar
                  dataKey="consumed"
                  name="Consumed"
                  fill="#ef4444"
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
