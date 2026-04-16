// Polling intervals (ms)
export const GPU_POLL_INTERVAL_MS = 5_000;
export const HEALTH_CHECK_INTERVAL_MS = 30_000;
export const HEALTH_CHECK_MAX_FAILURES = 3;

// Idle detection thresholds
export const IDLE_GPU_UTILIZATION_THRESHOLD = 10; // percent
export const IDLE_GPU_CONSECUTIVE_SECONDS = 60;
export const BUSY_GPU_UTILIZATION_THRESHOLD = 50; // percent
export const PREEMPTION_GRACE_PERIOD_MS = 30_000;

// Networking
export const GRPC_DEFAULT_PORT = 50051;
export const COORDINATION_SERVER_URL = 'https://gpucoop.workers.dev';
export const INVITE_CODE_TTL_HOURS = 24;

// Ollama
export const OLLAMA_DEFAULT_URL = 'http://localhost:11434';
export const OLLAMA_CHUNK_SIZE_BYTES = 65_536; // 64 KB

// Daemon IPC message types
export const DAEMON_MSG = {
  RESOURCE_UPDATE: 'resource:update',
  PEER_CONNECTED: 'peer:connected',
  PEER_DISCONNECTED: 'peer:disconnected',
  PEER_STATUS_CHANGED: 'peer:status-changed',
  JOB_STATUS_CHANGED: 'job:status-changed',
  JOB_PROGRESS: 'job:progress',
  JOB_COMPLETED: 'job:completed',
  JOB_PREEMPTED: 'job:preempted',
  ACTIVITY_CHANGED: 'activity:changed',
  OLLAMA_STATUS: 'ollama:status',
  READY: 'daemon:ready',
} as const;
