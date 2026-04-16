import { create } from 'zustand';
import type {
  Peer,
  ResourceStatus,
  Job,
  AppStatus,
  AppSettings,
  OllamaModel,
  UsageSummary,
  Group,
} from '../../shared/types';
import { DEFAULT_SETTINGS } from '../../shared/types';

interface CoopStore {
  // App status
  appStatus: AppStatus;
  setAppStatus: (status: Partial<AppStatus>) => void;

  // Group
  group: Group | null;
  setGroup: (group: Group | null) => void;

  // Peers
  peers: Peer[];
  setPeers: (peers: Peer[]) => void;
  updatePeer: (peerId: string, updates: Partial<Peer>) => void;

  // Resources
  localResource: ResourceStatus | null;
  setLocalResource: (r: ResourceStatus | null) => void;
  peerResources: Map<string, ResourceStatus>;
  updatePeerResource: (peerId: string, r: ResourceStatus) => void;

  // Jobs
  jobs: Job[];
  setJobs: (jobs: Job[]) => void;
  updateJob: (jobId: string, updates: Partial<Job>) => void;

  // Usage
  usageSummary: UsageSummary[];
  setUsageSummary: (summary: UsageSummary[]) => void;

  // Settings
  settings: AppSettings;
  setSettings: (settings: Partial<AppSettings>) => void;

  // Ollama
  ollamaModels: OllamaModel[];
  setOllamaModels: (models: OllamaModel[]) => void;
  ollamaConnected: boolean;
  setOllamaConnected: (v: boolean) => void;
}

export const useStore = create<CoopStore>((set) => ({
  appStatus: {
    daemonRunning: false,
    ollamaRunning: false,
    peersOnline: 0,
    jobsRunning: 0,
    localActivity: 'IDLE',
  },
  setAppStatus: (status) =>
    set((s) => ({ appStatus: { ...s.appStatus, ...status } })),

  group: null,
  setGroup: (group) => set({ group }),

  peers: [],
  setPeers: (peers) => set({ peers }),
  updatePeer: (peerId, updates) =>
    set((s) => ({
      peers: s.peers.map((p) =>
        p.peerId === peerId ? { ...p, ...updates } : p
      ),
    })),

  localResource: null,
  setLocalResource: (localResource) => set({ localResource }),
  peerResources: new Map(),
  updatePeerResource: (peerId, r) =>
    set((s) => {
      const next = new Map(s.peerResources);
      next.set(peerId, r);
      return { peerResources: next };
    }),

  jobs: [],
  setJobs: (jobs) => set({ jobs }),
  updateJob: (jobId, updates) =>
    set((s) => ({
      jobs: s.jobs.map((j) =>
        j.jobId === jobId ? { ...j, ...updates } : j
      ),
    })),

  usageSummary: [],
  setUsageSummary: (usageSummary) => set({ usageSummary }),

  settings: DEFAULT_SETTINGS,
  setSettings: (settings) =>
    set((s) => ({ settings: { ...s.settings, ...settings } })),

  ollamaModels: [],
  setOllamaModels: (ollamaModels) => set({ ollamaModels }),
  ollamaConnected: false,
  setOllamaConnected: (ollamaConnected) => set({ ollamaConnected }),
}));
