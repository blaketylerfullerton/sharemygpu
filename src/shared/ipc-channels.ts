// Typed IPC channel names
// renderer → main (invoke/handle)
export const IPC = {
  // Group management
  GROUP_CREATE: 'group:create',
  GROUP_JOIN: 'group:join',
  GROUP_LEAVE: 'group:leave',
  GROUP_GET_INVITE_CODE: 'group:get-invite-code',
  GROUP_GET: 'group:get',

  // Peers
  PEERS_LIST: 'peers:list',
  PEERS_STATUS: 'peers:status',

  // Jobs
  JOBS_SUBMIT: 'jobs:submit',
  JOBS_CANCEL: 'jobs:cancel',
  JOBS_LIST: 'jobs:list',
  JOBS_RESULTS: 'jobs:results',

  // Resources
  RESOURCES_LOCAL: 'resources:local',
  RESOURCES_POOL: 'resources:pool',

  // Usage
  USAGE_SUMMARY: 'usage:summary',
  USAGE_HISTORY: 'usage:history',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_UPDATE: 'settings:update',

  // Ollama
  OLLAMA_MODELS: 'ollama:models',
  OLLAMA_POOL_MODELS: 'ollama:pool-models',
  OLLAMA_PULL: 'ollama:pull',
  OLLAMA_STATUS: 'ollama:status',

  // System
  APP_SET_DND: 'app:set-dnd',
  APP_GET_STATUS: 'app:get-status',

  // Direct connect (LAN)
  PEER_CONNECT: 'peer:connect',
  APP_GET_LOCAL_ADDRESSES: 'app:get-local-addresses',
} as const;

// main → renderer (send/on) events
export const IPC_EVENTS = {
  PEER_CONNECTED: 'peer:connected',
  PEER_DISCONNECTED: 'peer:disconnected',
  PEER_STATUS_CHANGED: 'peer:status-changed',
  JOB_STATUS_CHANGED: 'job:status-changed',
  JOB_PROGRESS: 'job:progress',
  JOB_COMPLETED: 'job:completed',
  JOB_PREEMPTED: 'job:preempted',
  RESOURCE_UPDATED: 'resource:updated',
  OLLAMA_STATUS_CHANGED: 'ollama:status-changed',
  DAEMON_STATUS_CHANGED: 'daemon:status-changed',
} as const;
