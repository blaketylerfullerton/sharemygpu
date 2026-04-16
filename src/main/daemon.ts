import { ChildProcess, fork } from 'child_process';
import path from 'path';
import { BrowserWindow } from 'electron';
import { DAEMON_MSG } from '../shared/constants';
import { IPC_EVENTS } from '../shared/ipc-channels';

export interface DaemonStatus {
  running: boolean;
  peersOnline: number;
  jobsRunning: number;
  dndEnabled: boolean;
}

export class DaemonManager {
  private process: ChildProcess | null = null;
  private status: DaemonStatus = {
    running: false,
    peersOnline: 0,
    jobsRunning: 0,
    dndEnabled: false,
  };
  private pendingRequests = new Map<
    string,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();

  async start(): Promise<void> {
    // In production: __dirname = dist/main, daemon is at dist/daemon/index.js
    // In dev: we compile first, so use the compiled output at dist/daemon/index.js
    const daemonPath = path.join(__dirname, '../daemon/index.js');
    const execArgs: string[] = [];

    this.process = fork(daemonPath, [], {
      execArgv: execArgs,
      silent: false,
      env: { ...process.env, DAEMON_MODE: 'true' },
    });

    this.process.on('message', (msg: unknown) => this.handleMessage(msg));
    this.process.on('exit', (code) => {
      console.log(`[daemon] exited with code ${code}`);
      this.status.running = false;
      this.broadcastToRenderers(IPC_EVENTS.DAEMON_STATUS_CHANGED, {
        running: false,
      });
    });

    this.process.on('error', (err) => {
      console.error('[daemon] error:', err);
    });

    // Wait for ready signal (up to 10s)
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Daemon startup timeout')),
        10_000
      );
      const handler = (msg: unknown) => {
        const m = msg as { type?: string };
        if (m?.type === DAEMON_MSG.READY) {
          clearTimeout(timeout);
          this.process?.off('message', handler);
          this.status.running = true;
          resolve();
        }
      };
      this.process?.on('message', handler);
    }).catch((err) => {
      console.warn('[daemon] startup warning:', err.message);
      this.status.running = true; // continue anyway
    });
  }

  private handleMessage(msg: unknown): void {
    const m = msg as { type?: string; requestId?: string; [k: string]: unknown };
    if (!m?.type) return;

    // Handle request/response pattern
    if (m.requestId && this.pendingRequests.has(m.requestId)) {
      const pending = this.pendingRequests.get(m.requestId)!;
      this.pendingRequests.delete(m.requestId);
      if (m.error) {
        pending.reject(new Error(m.error as string));
      } else {
        pending.resolve(m.data);
      }
      return;
    }

    // Broadcast events to all renderer windows
    switch (m.type) {
      case DAEMON_MSG.PEER_CONNECTED:
        this.broadcastToRenderers(IPC_EVENTS.PEER_CONNECTED, m.data);
        break;
      case DAEMON_MSG.PEER_DISCONNECTED:
        this.broadcastToRenderers(IPC_EVENTS.PEER_DISCONNECTED, m.data);
        this.status.peersOnline = Math.max(0, this.status.peersOnline - 1);
        break;
      case DAEMON_MSG.PEER_STATUS_CHANGED:
        this.broadcastToRenderers(IPC_EVENTS.PEER_STATUS_CHANGED, m.data);
        break;
      case DAEMON_MSG.JOB_STATUS_CHANGED:
        this.broadcastToRenderers(IPC_EVENTS.JOB_STATUS_CHANGED, m.data);
        break;
      case DAEMON_MSG.JOB_PROGRESS:
        this.broadcastToRenderers(IPC_EVENTS.JOB_PROGRESS, m.data);
        break;
      case DAEMON_MSG.JOB_COMPLETED:
        this.broadcastToRenderers(IPC_EVENTS.JOB_COMPLETED, m.data);
        break;
      case DAEMON_MSG.JOB_PREEMPTED:
        this.broadcastToRenderers(IPC_EVENTS.JOB_PREEMPTED, m.data);
        break;
      case DAEMON_MSG.RESOURCE_UPDATE:
        this.broadcastToRenderers(IPC_EVENTS.RESOURCE_UPDATED, m.data);
        break;
      case DAEMON_MSG.OLLAMA_STATUS:
        this.broadcastToRenderers(IPC_EVENTS.OLLAMA_STATUS_CHANGED, m.data);
        break;
    }
  }

  private broadcastToRenderers(channel: string, data: unknown): void {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, data);
      }
    }
  }

  send(msg: Record<string, unknown>): void {
    if (this.process && !this.process.killed) {
      this.process.send(msg);
    }
  }

  request<T>(type: string, data?: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      const requestId = Math.random().toString(36).slice(2);
      this.pendingRequests.set(requestId, {
        resolve: resolve as (v: unknown) => void,
        reject,
      });
      this.send({ type, requestId, data });
      // Timeout after 30s
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error(`Request timeout: ${type}`));
        }
      }, 30_000);
    });
  }

  getStatus(): DaemonStatus {
    return { ...this.status };
  }

  async stop(): Promise<void> {
    if (this.process && !this.process.killed) {
      this.process.send({ type: 'shutdown' });
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          this.process?.kill();
          resolve();
        }, 5_000);
        this.process?.once('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
  }
}
