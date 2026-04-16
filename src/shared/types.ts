// ─── Peer & Resources ────────────────────────────────────────────────────────

export type PeerStatus = 'online' | 'idle' | 'busy' | 'offline';
export type OwnerActivity = 'IDLE' | 'LIGHT_USE' | 'HEAVY_USE' | 'DO_NOT_DISTURB';

export interface Peer {
  peerId: string;
  displayName: string;
  wireguardPublicKey: string;
  endpoint?: string;
  gpuModel?: string;
  totalVramMb?: number;
  totalRamMb?: number;
  totalCpuCores?: number;
  lastSeenAt?: number;
  status: PeerStatus;
  createdAt: number;
  isLocal?: boolean;
}

export interface ResourceStatus {
  peerId: string;
  gpuModel: string;
  totalVramMb: number;
  availableVramMb: number;
  totalRamMb: number;
  availableRamMb: number;
  totalCpuCores: number;
  idleCpuCores: number;
  gpuUtilizationPct: number;
  activity: OwnerActivity;
  timestamp: number;
}

// ─── Jobs ────────────────────────────────────────────────────────────────────

export type JobType = 'llm_batch' | 'llm_single' | 'custom';
export type JobPriority = 'low' | 'normal' | 'high';
export type JobStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'preempted'
  | 'cancelled';

export interface Job {
  jobId: string;
  submitterPeerId: string;
  executorPeerId?: string;
  jobType: JobType;
  modelName?: string;
  inputSummary?: string;
  inputCount?: number;
  status: JobStatus;
  priority: JobPriority;
  submittedAt: number;
  startedAt?: number;
  completedAt?: number;
  gpuSecondsUsed: number;
  errorMessage?: string;
  progress?: number; // 0-100
}

export interface JobSubmission {
  jobType: JobType;
  modelName: string;
  prompts: string[];
  priority: JobPriority;
  preferredPeerIds?: string[];
  timeoutSeconds?: number;
}

export interface JobResult {
  id: number;
  jobId: string;
  inputIndex: number;
  inputText?: string;
  outputText?: string;
  tokensGenerated?: number;
  inferenceTimeMs?: number;
}

// ─── Usage ───────────────────────────────────────────────────────────────────

export interface UsageSummary {
  peerId: string;
  displayName: string;
  gpuSecondsContributed: number;
  gpuSecondsConsumed: number;
  netBalance: number;
}

export interface UsageEntry {
  id: number;
  peerId: string;
  direction: 'contributed' | 'consumed';
  gpuSeconds: number;
  cpuSeconds: number;
  bytesTransferred: number;
  jobId?: string;
  recordedAt: number;
}

// ─── Models ──────────────────────────────────────────────────────────────────

export interface OllamaModel {
  name: string;
  size: number;
  digest: string;
  modifiedAt: string;
}

// ─── Settings ────────────────────────────────────────────────────────────────

export interface AppSettings {
  displayName: string;
  maxVramShareMb: number;
  maxCpuCoresShare: number;
  quietHoursStart?: string; // "HH:MM"
  quietHoursEnd?: string;
  notifyJobComplete: boolean;
  notifyPeerJoined: boolean;
  notifyPreemption: boolean;
  ollamaPath: string;
  ollamaPort: number;
  dndEnabled: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  displayName: 'My Machine',
  maxVramShareMb: 0, // 0 = unlimited
  maxCpuCoresShare: 0,
  notifyJobComplete: true,
  notifyPeerJoined: true,
  notifyPreemption: true,
  ollamaPath: '',
  ollamaPort: 11434,
  dndEnabled: false,
};

// ─── App Status ──────────────────────────────────────────────────────────────

export interface AppStatus {
  daemonRunning: boolean;
  ollamaRunning: boolean;
  peersOnline: number;
  jobsRunning: number;
  localActivity: OwnerActivity;
  localAddresses?: string[];
  grpcPort?: number;
  peerId?: string;
}

// ─── Group ───────────────────────────────────────────────────────────────────

export interface Group {
  groupId: string;
  groupName?: string;
  inviteCode?: string;
  createdAt: number;
  isHost: boolean;
}
