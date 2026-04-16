import React, { useEffect } from 'react';
import { HashRouter, NavLink, Route, Routes, Navigate } from 'react-router-dom';
import { Home, ListChecks, Send, BarChart3, Settings as SettingsIcon } from 'lucide-react';
import { PoolOverview } from './pages/PoolOverview';
import { JobQueue } from './pages/JobQueue';
import { SubmitJob } from './pages/SubmitJob';
import { UsageLedger } from './pages/UsageLedger';
import { Settings } from './pages/Settings';
import { usePeers } from './hooks/usePeers';
import { useJobs } from './hooks/useJobs';
import { useIPC } from './hooks/useIPC';
import { useStore } from './store';
import { IPC } from '../shared/ipc-channels';
import type { AppSettings, Group } from '../shared/types';

const NAV = [
  { to: '/pool', label: 'Pool', icon: Home },
  { to: '/jobs', label: 'Jobs', icon: ListChecks },
  { to: '/submit', label: 'Submit', icon: Send },
  { to: '/usage', label: 'Usage', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

function Sidebar() {
  return (
    <aside className="w-56 bg-slate-900 border-r border-slate-800 flex flex-col">
      <div className="p-5 border-b border-slate-800">
        <div className="text-sm font-semibold tracking-wide text-slate-100">
          GPU Co-op
        </div>
        <div className="text-[11px] text-slate-500 mt-0.5">
          Share GPUs with friends
        </div>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>
      <StatusFooter />
    </aside>
  );
}

function StatusFooter() {
  const { appStatus, ollamaConnected } = useStore();
  return (
    <div className="p-4 border-t border-slate-800 text-[11px] text-slate-500 space-y-1">
      <div className="flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full ${appStatus.daemonRunning ? 'bg-green-400' : 'bg-red-400'}`} />
        Daemon {appStatus.daemonRunning ? 'running' : 'stopped'}
      </div>
      <div className="flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full ${ollamaConnected ? 'bg-green-400' : 'bg-slate-600'}`} />
        Ollama {ollamaConnected ? 'connected' : 'offline'}
      </div>
      <div>
        {appStatus.peersOnline} peer{appStatus.peersOnline === 1 ? '' : 's'} online
      </div>
    </div>
  );
}

/** Runs once at mount — pulls initial state from daemon via IPC */
function DaemonBootstrap() {
  const { invoke } = useIPC();
  const { setAppStatus, setSettings, setGroup, setOllamaConnected } = useStore();

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        const [status, settings, group, ollama] = await Promise.all([
          invoke<any>(IPC.APP_GET_STATUS).catch(() => null),
          invoke<AppSettings>(IPC.SETTINGS_GET).catch(() => null),
          invoke<Group>(IPC.GROUP_GET).catch(() => null),
          invoke<{ connected: boolean }>(IPC.OLLAMA_STATUS).catch(() => null),
        ]);
        if (cancelled) return;
        if (status) setAppStatus(status);
        if (settings) setSettings(settings);
        if (group) setGroup(group);
        if (ollama) setOllamaConnected(ollama.connected);
      } catch {
        // daemon not ready
      }
    };

    bootstrap();
    const interval = setInterval(bootstrap, 5_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [invoke, setAppStatus, setSettings, setGroup, setOllamaConnected]);

  // Subscribe to peer & job streams
  usePeers();
  useJobs();
  return null;
}

export default function App() {
  return (
    <HashRouter>
      <DaemonBootstrap />
      <div className="flex h-screen bg-slate-950 text-slate-100">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/pool" replace />} />
            <Route path="/pool" element={<PoolOverview />} />
            <Route path="/jobs" element={<JobQueue />} />
            <Route path="/submit" element={<SubmitJob />} />
            <Route path="/usage" element={<UsageLedger />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}
