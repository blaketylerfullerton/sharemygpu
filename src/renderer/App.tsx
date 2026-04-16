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

function MeshIcon() {
  return (
    <div className="relative" style={{ width: 32, height: 32 }}>
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <path
          d="M16 2L28 9V23L16 30L4 23V9L16 2Z"
          stroke="#58e6d9"
          strokeWidth="0.8"
          opacity="0.2"
        />
        <path
          d="M16 8L22.5 11.75V19.25L16 23L9.5 19.25V11.75L16 8Z"
          stroke="#58e6d9"
          strokeWidth="1.2"
          fill="#58e6d9"
          fillOpacity="0.06"
        />
        <line x1="16" y1="15.5" x2="16" y2="8" stroke="#58e6d9" strokeWidth="0.5" opacity="0.25" />
        <line x1="16" y1="15.5" x2="22.5" y2="11.75" stroke="#58e6d9" strokeWidth="0.5" opacity="0.25" />
        <line x1="16" y1="15.5" x2="22.5" y2="19.25" stroke="#58e6d9" strokeWidth="0.5" opacity="0.25" />
        <line x1="16" y1="15.5" x2="16" y2="23" stroke="#58e6d9" strokeWidth="0.5" opacity="0.25" />
        <line x1="16" y1="15.5" x2="9.5" y2="19.25" stroke="#58e6d9" strokeWidth="0.5" opacity="0.25" />
        <line x1="16" y1="15.5" x2="9.5" y2="11.75" stroke="#58e6d9" strokeWidth="0.5" opacity="0.25" />
        <circle cx="16" cy="15.5" r="2.5" fill="#58e6d9" />
        <circle cx="16" cy="8" r="1.5" fill="#58e6d9" opacity="0.5" />
        <circle cx="22.5" cy="11.75" r="1.5" fill="#58e6d9" opacity="0.5" />
        <circle cx="22.5" cy="19.25" r="1.5" fill="#58e6d9" opacity="0.5" />
        <circle cx="16" cy="23" r="1.5" fill="#58e6d9" opacity="0.5" />
        <circle cx="9.5" cy="19.25" r="1.5" fill="#58e6d9" opacity="0.5" />
        <circle cx="9.5" cy="11.75" r="1.5" fill="#58e6d9" opacity="0.5" />
      </svg>
      <div
        className="absolute inset-0 animate-glow-pulse"
        style={{
          background: 'radial-gradient(circle, rgba(88, 230, 217, 0.12) 0%, transparent 70%)',
          filter: 'blur(6px)',
        }}
      />
    </div>
  );
}

function Logo() {
  return (
    <div className="px-5 py-5" style={{ borderBottom: '1px solid #21262d' }}>
      <div className="flex items-center gap-3">
        <MeshIcon />
        <div>
          <div
            className="font-display text-[13px] font-semibold tracking-[0.18em]"
            style={{ color: '#e6edf3' }}
          >
            GPU CO-OP
          </div>
          <div className="font-mono text-[9px] tracking-[0.12em] mt-0.5" style={{ color: '#484f58' }}>
            COMPUTE MESH
          </div>
        </div>
      </div>
    </div>
  );
}

function Sidebar() {
  return (
    <aside
      className="w-56 flex flex-col shrink-0"
      style={{ background: '#0d1117', borderRight: '1px solid #21262d' }}
    >
      <Logo />
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className="relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-200"
            style={({ isActive }) => ({
              background: isActive ? 'rgba(88, 230, 217, 0.06)' : 'transparent',
              color: isActive ? '#58e6d9' : '#7d8590',
            })}
          >
            {({ isActive }: { isActive: boolean }) => (
              <>
                {isActive && (
                  <div
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-4 rounded-r-full"
                    style={{ background: '#58e6d9', boxShadow: '0 0 8px rgba(88, 230, 217, 0.4)' }}
                  />
                )}
                <Icon size={16} strokeWidth={isActive ? 2 : 1.5} />
                {label}
              </>
            )}
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
    <div
      className="px-5 py-4 space-y-2.5 font-mono"
      style={{ borderTop: '1px solid #21262d', fontSize: '10px' }}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="w-[5px] h-[5px] rounded-full shrink-0"
          style={{
            background: appStatus.daemonRunning ? '#39d353' : '#f85149',
            boxShadow: appStatus.daemonRunning
              ? '0 0 6px rgba(57, 211, 83, 0.5)'
              : '0 0 6px rgba(248, 81, 73, 0.5)',
          }}
        />
        <span style={{ color: '#7d8590' }}>
          daemon {appStatus.daemonRunning ? 'online' : 'offline'}
        </span>
      </div>
      <div className="flex items-center gap-2.5">
        <span
          className="w-[5px] h-[5px] rounded-full shrink-0"
          style={{
            background: ollamaConnected ? '#39d353' : '#484f58',
            boxShadow: ollamaConnected ? '0 0 6px rgba(57, 211, 83, 0.5)' : 'none',
          }}
        />
        <span style={{ color: '#7d8590' }}>
          ollama {ollamaConnected ? 'ready' : 'n/a'}
        </span>
      </div>
      <div className="flex items-center gap-2.5" style={{ color: '#7d8590' }}>
        <span
          className="w-[5px] h-[5px] rounded-full shrink-0"
          style={{ background: '#58e6d9', boxShadow: '0 0 6px rgba(88, 230, 217, 0.4)' }}
        />
        <span>
          <span style={{ color: '#58e6d9', fontWeight: 600 }}>{appStatus.peersOnline}</span>
          {' '}peer{appStatus.peersOnline === 1 ? '' : 's'} connected
        </span>
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
  }, [setAppStatus, setSettings, setGroup, setOllamaConnected]);

  usePeers();
  useJobs();
  return null;
}

export default function App() {
  return (
    <HashRouter>
      <DaemonBootstrap />
      <div className="flex h-screen" style={{ background: '#06080d' }}>
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-grid" style={{ background: '#06080d' }}>
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
