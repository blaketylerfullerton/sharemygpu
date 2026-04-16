/**
 * GPU Co-op Daemon
 * Runs as a forked child process from the Electron main process.
 * Communicates with main via process.send() / process.on('message').
 */

import { v4 as uuidv4 } from 'uuid';
import os from 'os';
import { ResourceMonitor } from './resource-monitor';
import { IdleDetector } from './idle-detector';
import { PeerManager } from './peer-manager';
import { Scheduler } from './scheduler';
import { OllamaClient } from './ollama-client';
import { UsageLedger } from './usage-ledger';
import { GrpcServer } from './grpc-server';
import { getConfig, setConfig, getJobs, getJobResults } from './db';
import { DAEMON_MSG } from '../shared/constants';
import type {
  AppSettings,
  JobSubmission,
  ResourceStatus,
} from '../shared/types';
import { DEFAULT_SETTINGS } from '../shared/types';

// ─── Init ─────────────────────────────────────────────────────────────────────

const peerId = getOrCreatePeerId();
const settings = loadSettings();

const resourceMonitor = new ResourceMonitor(peerId);
const idleDetector = new IdleDetector();
const peerManager = new PeerManager(peerId, () => resourceMonitor.getLatest());
const ollama = new OllamaClient(settings.ollamaPort);
const scheduler = new Scheduler(peerId, ollama);
const ledger = new UsageLedger();
const grpcServer = new GrpcServer({
  localPeerId: peerId,
  getLocalResource: () => resourceMonitor.getLatest(),
  onPeerResource: (resource) => {
    peerManager.handlePeerResource(resource.peerId, resource);
    broadcast(DAEMON_MSG.RESOURCE_UPDATE, resource);
  },
});

let ollamaConnected = false;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getOrCreatePeerId(): string {
  let id = getConfig('peer_id');
  if (!id) {
    id = uuidv4();
    setConfig('peer_id', id);
  }
  return id;
}

function loadSettings(): AppSettings {
  const raw = getConfig('settings');
  if (raw) {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {}
  }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(s: AppSettings): void {
  setConfig('settings', JSON.stringify(s));
}

function reply(requestId: string, data: unknown, error?: string): void {
  process.send?.({ requestId, data, error });
}

function broadcast(type: string, data: unknown): void {
  process.send?.({ type, data });
}

// ─── Event wiring ─────────────────────────────────────────────────────────────

resourceMonitor.on('update', (resource: ResourceStatus) => {
  idleDetector.update(resource);
  peerManager.updateLocalPeerInfo(resource);
  // Push local status to all connected peers (both as client and via server streams)
  peerManager.broadcastLocalResource(resource);
  grpcServer.broadcastResource(resource);
  broadcast(DAEMON_MSG.RESOURCE_UPDATE, resource);
});

// Emit peer connection events up to the main process / renderer
peerManager.on('peer:connected', (data) =>
  broadcast(DAEMON_MSG.PEER_CONNECTED, data)
);
peerManager.on('peer:disconnected', (peerId: string) =>
  broadcast(DAEMON_MSG.PEER_DISCONNECTED, peerId)
);
peerManager.on('peer:resource-updated', (peerId: string, resource: ResourceStatus) => {
  broadcast(DAEMON_MSG.RESOURCE_UPDATE, resource);
  broadcast(DAEMON_MSG.PEER_STATUS_CHANGED, { peerId, status: 'online' });
});

idleDetector.on('change', (activity: string, prev: string) => {
  broadcast(DAEMON_MSG.ACTIVITY_CHANGED, { activity, prev });

  if (idleDetector.shouldPreempt()) {
    scheduler.preemptAllRemoteJobs();
  }
});

scheduler.on('job:status-changed', (data) =>
  broadcast(DAEMON_MSG.JOB_STATUS_CHANGED, data)
);
scheduler.on('job:progress', (data) =>
  broadcast(DAEMON_MSG.JOB_PROGRESS, data)
);
scheduler.on('job:completed', (data) =>
  broadcast(DAEMON_MSG.JOB_COMPLETED, data)
);
scheduler.on('job:preempted', (data) =>
  broadcast(DAEMON_MSG.JOB_PREEMPTED, data)
);

// ─── IPC message handler ──────────────────────────────────────────────────────

process.on('message', async (msg: unknown) => {
  const m = msg as {
    type?: string;
    requestId?: string;
    data?: unknown;
    enabled?: boolean;
  };
  if (!m?.type) return;

  const { type, requestId, data } = m;

  // Fire-and-forget messages (no requestId)
  if (type === 'set-dnd') {
    idleDetector.setDnd(m.enabled ?? false);
    return;
  }

  if (type === 'shutdown') {
    await gracefulShutdown();
    process.exit(0);
  }

  // Request/response messages
  if (!requestId) return;

  try {
    switch (type) {
      // ── Group ──────────────────────────────────────────────────────────────
      case 'group:create': {
        const groupId = uuidv4();
        const inviteCode = generateInviteCode();
        setConfig('group_id', groupId);
        setConfig('invite_code', inviteCode);
        setConfig('is_host', '1');
        reply(requestId, { groupId, inviteCode });
        break;
      }

      case 'group:join': {
        const code = data as string;
        // MVP: store code, real joining happens in Phase 4
        setConfig('invite_code', code);
        setConfig('is_host', '0');
        reply(requestId, { success: true });
        break;
      }

      case 'group:leave': {
        setConfig('group_id', '');
        setConfig('invite_code', '');
        reply(requestId, null);
        break;
      }

      case 'group:get-invite-code': {
        reply(requestId, getConfig('invite_code') ?? '');
        break;
      }

      case 'group:get': {
        const gid = getConfig('group_id');
        if (!gid) {
          reply(requestId, null);
          break;
        }
        reply(requestId, {
          groupId: gid,
          groupName: 'My Co-op Pool',
          inviteCode: getConfig('invite_code') ?? undefined,
          createdAt: Date.now(),
          isHost: getConfig('is_host') === '1',
        });
        break;
      }

      // ── Peer direct connect ────────────────────────────────────────────────
      case 'peer:connect': {
        const address = data as string;
        const result = await peerManager.connectToPeer(address);
        reply(requestId, result);
        break;
      }

      // ── Peers ──────────────────────────────────────────────────────────────
      case 'peers:list': {
        reply(requestId, peerManager.getPeers());
        break;
      }

      case 'peers:status': {
        reply(requestId, peerManager.getPeers());
        break;
      }

      // ── Resources ─────────────────────────────────────────────────────────
      case 'resources:local': {
        reply(requestId, resourceMonitor.getLatest());
        break;
      }

      case 'resources:pool': {
        reply(requestId, peerManager.getPeerResources());
        break;
      }

      // ── Jobs ───────────────────────────────────────────────────────────────
      case 'jobs:submit': {
        const submission = data as JobSubmission;
        const jobId = await scheduler.submitJob(submission, peerId);
        reply(requestId, { jobId });
        break;
      }

      case 'jobs:cancel': {
        scheduler.cancelJob(data as string);
        reply(requestId, null);
        break;
      }

      case 'jobs:list': {
        reply(requestId, getJobs());
        break;
      }

      case 'jobs:results': {
        reply(requestId, getJobResults(data as string));
        break;
      }

      // ── Usage ──────────────────────────────────────────────────────────────
      case 'usage:summary': {
        reply(requestId, ledger.getSummary());
        break;
      }

      case 'usage:history': {
        reply(requestId, ledger.getHistory(data as number));
        break;
      }

      // ── Settings ───────────────────────────────────────────────────────────
      case 'settings:get': {
        reply(requestId, loadSettings());
        break;
      }

      case 'settings:update': {
        const updated = { ...loadSettings(), ...(data as Partial<AppSettings>) };
        saveSettings(updated);
        ollama.updatePort(updated.ollamaPort);
        reply(requestId, updated);
        break;
      }

      // ── Ollama ─────────────────────────────────────────────────────────────
      case 'ollama:models': {
        const models = await ollama.listModels();
        reply(requestId, models);
        break;
      }

      case 'ollama:pool-models': {
        const models = await ollama.listModels();
        reply(requestId, [{ peerId, models }]);
        break;
      }

      case 'ollama:pull': {
        await ollama.pullModel(data as string);
        reply(requestId, null);
        break;
      }

      case 'ollama:status': {
        reply(requestId, { connected: ollamaConnected });
        break;
      }

      // ── App status ─────────────────────────────────────────────────────────
      case 'app:get-status': {
        reply(requestId, {
          daemonRunning: true,
          ollamaRunning: ollamaConnected,
          peersOnline: peerManager.getPeers().filter((p) => p.status !== 'offline').length,
          jobsRunning: getJobs().filter((j: unknown) => (j as { status: string }).status === 'running').length,
          localActivity: idleDetector.getActivity(),
          localAddresses: getLocalAddresses(),
          grpcPort: 50051,
          peerId,
        });
        break;
      }

      case 'app:get-local-addresses': {
        reply(requestId, getLocalAddresses());
        break;
      }

      default:
        reply(requestId, null, `Unknown message type: ${type}`);
    }
  } catch (err) {
    reply(requestId, null, String(err));
  }
});

// ─── Startup ──────────────────────────────────────────────────────────────────

async function startup(): Promise<void> {
  // Register local peer
  const resource = resourceMonitor.getLatest();
  peerManager.registerLocalPeer({
    displayName: settings.displayName,
    gpuModel: resource?.gpuModel,
    totalVramMb: resource?.totalVramMb,
    totalRamMb: resource?.totalRamMb,
    totalCpuCores: resource?.totalCpuCores,
  });

  // Start monitoring
  resourceMonitor.start();
  peerManager.start();

  // Start gRPC server so peers can connect to us
  try {
    await grpcServer.start();
  } catch (err) {
    console.error('[daemon] gRPC server failed to start:', err);
  }

  // Check Ollama
  const connected = await ollama.checkConnection();
  ollamaConnected = connected;
  broadcast(DAEMON_MSG.OLLAMA_STATUS, {
    connected,
    models: connected ? await ollama.listModels() : [],
  });

  // Signal ready
  process.send?.({ type: DAEMON_MSG.READY });
  console.log(`[daemon] ready — peer: ${peerId}`);
}

async function gracefulShutdown(): Promise<void> {
  resourceMonitor.stop();
  peerManager.stop();
  grpcServer.stop();
  console.log('[daemon] shutdown complete');
}

function getLocalAddresses(): string[] {
  const addrs: string[] = [];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (!iface) continue;
    for (const info of iface) {
      if (info.family === 'IPv4' && !info.internal) {
        addrs.push(info.address);
      }
    }
  }
  return addrs;
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const rand = (n: number) => Math.floor(Math.random() * n);
  const seg = (len: number) =>
    Array.from({ length: len }, () => chars[rand(chars.length)]).join('');
  return `${seg(3)}-${seg(3)}-${seg(3)}`;
}

startup().catch((err) => {
  console.error('[daemon] startup failed:', err);
  process.exit(1);
});
