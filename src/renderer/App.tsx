import React, { useMemo, useState } from 'react';

type Device = {
  id: string;
  name: string;
  model: string;
  vramTotalGb: number;
  vramUsedGb: number;
  status: 'idle' | 'busy' | 'offline';
  ip: string;
};

const DEVICES: Device[] = [
  { id: '1', name: "blake's dgx spark", model: 'NVIDIA DGX Spark', vramTotalGb: 128, vramUsedGb: 14, status: 'idle', ip: '10.0.0.4' },
  { id: '2', name: 'studio-mini', model: 'Apple M3 Ultra', vramTotalGb: 192, vramUsedGb: 88, status: 'busy', ip: '10.0.0.7' },
  { id: '3', name: 'tower', model: 'NVIDIA RTX 4090', vramTotalGb: 24, vramUsedGb: 2, status: 'idle', ip: '10.0.0.12' },
  { id: '4', name: "jen's spark", model: 'NVIDIA DGX Spark', vramTotalGb: 128, vramUsedGb: 0, status: 'idle', ip: '10.0.0.18' },
  { id: '5', name: 'rack-01', model: 'NVIDIA H100', vramTotalGb: 80, vramUsedGb: 72, status: 'busy', ip: '10.0.0.22' },
  { id: '6', name: 'macbook', model: 'Apple M2 Max', vramTotalGb: 64, vramUsedGb: 0, status: 'offline', ip: '10.0.0.31' },
];

type ConnState = 'idle' | 'starting' | 'ready';

function StatusDot({ status }: { status: Device['status'] }) {
  const color =
    status === 'idle' ? 'bg-emerald-400' : status === 'busy' ? 'bg-amber-400' : 'bg-neutral-600';
  return (
    <span className="relative flex h-1.5 w-1.5">
      {status === 'idle' && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
      )}
      <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${color}`} />
    </span>
  );
}

function DeviceRow({ d }: { d: Device }) {
  const freeGb = d.vramTotalGb - d.vramUsedGb;
  const pct = (d.vramUsedGb / d.vramTotalGb) * 100;
  const isOffline = d.status === 'offline';
  const [conn, setConn] = useState<ConnState>('idle');
  const [copied, setCopied] = useState(false);

  const endpoint = `http://${d.ip}:11434`;

  const connect = () => {
    if (isOffline || conn !== 'idle') return;
    setConn('starting');
    setTimeout(() => setConn('ready'), 1100);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(endpoint);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div
      className={`group border-b border-neutral-900 transition-colors ${
        isOffline ? 'opacity-40' : 'hover:bg-neutral-900/40'
      }`}
    >
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-6 px-6 py-5">
        <StatusDot status={d.status} />

        <div className="min-w-0">
          <div className="flex items-baseline gap-3">
            <span className="text-[15px] text-neutral-100 tracking-tight truncate">{d.name}</span>
            <span className="text-xs text-neutral-500 font-mono">{d.ip}</span>
          </div>
          <div className="mt-0.5 text-xs text-neutral-500">{d.model}</div>
        </div>

        <div className="flex items-center gap-5 min-w-[340px] justify-end">
          <div className="w-24 h-[2px] bg-neutral-900 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                isOffline ? 'bg-neutral-700' : pct > 80 ? 'bg-amber-400' : 'bg-neutral-300'
              }`}
              style={{ width: `${isOffline ? 0 : pct}%` }}
            />
          </div>
          <div className="text-right tabular-nums w-16">
            <div className="text-[15px] text-neutral-100">
              {isOffline ? '—' : `${freeGb} GB`}
            </div>
            <div className="text-[10px] text-neutral-600 uppercase tracking-widest">
              {isOffline ? 'offline' : 'free'}
            </div>
          </div>

          <button
            onClick={connect}
            disabled={isOffline || conn !== 'idle'}
            className={`text-[11px] uppercase tracking-widest px-3 py-1.5 rounded-full border transition-colors
              ${
                isOffline
                  ? 'border-neutral-900 text-neutral-700 cursor-not-allowed'
                  : conn === 'ready'
                  ? 'border-emerald-900 text-emerald-400'
                  : 'border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-neutral-100'
              }`}
          >
            {conn === 'idle' && 'Connect'}
            {conn === 'starting' && 'Starting…'}
            {conn === 'ready' && '● Ready'}
          </button>
        </div>
      </div>

      {conn === 'ready' && (
        <div className="px-6 pb-5 -mt-2 ml-[calc(1.5rem+6px+1.5rem)] animate-in fade-in">
          <div className="flex items-center gap-3 text-[11px] font-mono">
            <span className="text-neutral-600 uppercase tracking-widest text-[10px]">endpoint</span>
            <code
              onClick={copy}
              className="text-neutral-200 bg-neutral-900 px-2.5 py-1 rounded cursor-pointer hover:bg-neutral-800 select-all"
              title="click to copy"
            >
              {endpoint}
            </code>
            <span className={`text-[10px] uppercase tracking-widest transition-opacity ${copied ? 'text-emerald-400 opacity-100' : 'opacity-0'}`}>
              copied
            </span>
          </div>
          <div className="mt-2 text-[11px] text-neutral-600 font-mono">
            ollama serve · llama3:8b · ready
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [now] = useState(() => new Date());
  const { online, totalFree, totalVram } = useMemo(() => {
    const on = DEVICES.filter((d) => d.status !== 'offline');
    return {
      online: on.length,
      totalFree: on.reduce((s, d) => s + (d.vramTotalGb - d.vramUsedGb), 0),
      totalVram: on.reduce((s, d) => s + d.vramTotalGb, 0),
    };
  }, []);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans">
      <div className="max-w-3xl mx-auto px-8 pt-16 pb-24">
        <header className="flex items-end justify-between mb-14">
          <div>
            <h1 className="text-[13px] uppercase tracking-[0.2em] text-neutral-500">Devices</h1>
            <p className="mt-2 text-2xl tracking-tight">Network</p>
          </div>
          <div className="text-right tabular-nums">
            <div className="text-2xl tracking-tight">
              {totalFree} <span className="text-neutral-600 text-base">/ {totalVram} GB</span>
            </div>
            <div className="text-[10px] text-neutral-500 uppercase tracking-widest mt-1">
              {online} online
            </div>
          </div>
        </header>

        <div className="border-t border-neutral-900">
          {DEVICES.map((d) => (
            <DeviceRow key={d.id} d={d} />
          ))}
        </div>

        <footer className="mt-10 text-[11px] text-neutral-600 tabular-nums">
          {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · gpu-coop
        </footer>
      </div>
    </div>
  );
}
