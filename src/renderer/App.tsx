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
  { to: '/pool',     label: 'Pool',     icon: Home },
  { to: '/jobs',     label: 'Jobs',     icon: ListChecks },
  { to: '/submit',   label: 'Submit',   icon: Send },
  { to: '/usage',    label: 'Usage',    icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

function Logo() {
  return (
    <div
      className="px-4 py-4"
      style={{ borderBottom: '1px solid #27272a' }}
    >
      <div className="flex items-center gap-2.5">
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            background: '#18181b',
            border: '1px solid #27272a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#a1a1aa" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="3" width="14" height="10" rx="1.5" />
            <path d="M4 7h8M4 9.5h5" />
          </svg>
        </div>
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#fafafa',
              letterSpacing: '-0.01em',
              fontFamily: 'Geist, system-ui, sans-serif',
            }}
          >
            GPU Co-op
          </div>
          <div
            style={{
              fontSize: 11,
              color: '#52525b',
              marginTop: 1,
              fontFamily: 'Geist Mono, ui-monospace, monospace',
            }}
          >
            compute mesh
          </div>
        </div>
      </div>
    </div>
  );
}

function Sidebar() {
  return (
    <aside
      className="w-52 flex flex-col shrink-0"
      style={{ background: '#09090b', borderRight: '1px solid #27272a' }}
    >
      <Logo />
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className="relative flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-all duration-150"
            style={({ isActive }) => ({
              background: isActive ? '#27272a' : 'transparent',
              color:      isActive ? '#fafafa' : '#71717a',
            })}
          >
            {({ isActive }: { isActive: boolean }) => (
              <>
                <Icon size={15} strokeWidth={isActive ? 2 : 1.5} />
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
      className="px-4 py-3 space-y-2"
      style={{
        borderTop: '1px solid #27272a',
        fontSize: 11,
        fontFamily: 'Geist Mono, ui-monospace, monospace',
        color: '#52525b',
      }}
    >
      <div className="flex items-center gap-2">
        <span
          style={{
            width: 5, height: 5,
            borderRadius: '50%',
            background: appStatus.daemonRunning ? '#4ade80' : '#f87171',
            flexShrink: 0,
            display: 'inline-block',
          }}
        />
        <span>daemon {appStatus.daemonRunning ? 'online' : 'offline'}</span>
      </div>
      <div className="flex items-center gap-2">
        <span
          style={{
            width: 5, height: 5,
            borderRadius: '50%',
            background: ollamaConnected ? '#4ade80' : '#3f3f46',
            flexShrink: 0,
            display: 'inline-block',
          }}
        />
        <span>ollama {ollamaConnected ? 'ready' : 'n/a'}</span>
      </div>
      <div className="flex items-center gap-2">
        <span
          style={{
            width: 5, height: 5,
            borderRadius: '50%',
            background: appStatus.peersOnline > 0 ? '#4ade80' : '#3f3f46',
            flexShrink: 0,
            display: 'inline-block',
          }}
        />
        <span>
          <span style={{ color: '#a1a1aa', fontWeight: 600 }}>{appStatus.peersOnline}</span>
          {' '}peer{appStatus.peersOnline === 1 ? '' : 's'} online
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
        if (status)  setAppStatus(status);
        if (settings) setSettings(settings);
        if (group)   setGroup(group);
        if (ollama)  setOllamaConnected(ollama.connected);
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
      <div className="flex h-screen" style={{ background: '#09090b' }}>
        <Sidebar />
        <main
          className="flex-1 overflow-y-auto"
          style={{ background: '#09090b' }}
        >
          <Routes>
            <Route path="/"         element={<Navigate to="/pool" replace />} />
            <Route path="/pool"     element={<PoolOverview />} />
            <Route path="/jobs"     element={<JobQueue />} />
            <Route path="/submit"   element={<SubmitJob />} />
            <Route path="/usage"    element={<UsageLedger />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}
