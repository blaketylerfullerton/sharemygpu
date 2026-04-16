import { ipcMain } from 'electron';
import { IPC } from '../shared/ipc-channels';
import { daemonManager } from './index';
import type {
  AppSettings,
  JobSubmission,
} from '../shared/types';

export function setupIPC(): void {
  // ─── Group ───────────────────────────────────────────────────────────────

  ipcMain.handle(IPC.GROUP_CREATE, async () => {
    return daemonManager?.request('group:create');
  });

  ipcMain.handle(IPC.GROUP_JOIN, async (_e, inviteCode: string) => {
    return daemonManager?.request('group:join', inviteCode);
  });

  ipcMain.handle(IPC.GROUP_LEAVE, async () => {
    return daemonManager?.request('group:leave');
  });

  ipcMain.handle(IPC.GROUP_GET_INVITE_CODE, async () => {
    return daemonManager?.request('group:get-invite-code');
  });

  ipcMain.handle(IPC.GROUP_GET, async () => {
    return daemonManager?.request('group:get');
  });

  // ─── Peers ───────────────────────────────────────────────────────────────

  ipcMain.handle(IPC.PEERS_LIST, async () => {
    return daemonManager?.request('peers:list');
  });

  ipcMain.handle(IPC.PEERS_STATUS, async () => {
    return daemonManager?.request('peers:status');
  });

  ipcMain.handle(IPC.PEER_CONNECT, async (_e, address: string) => {
    return daemonManager?.request('peer:connect', address);
  });

  // ─── Jobs ────────────────────────────────────────────────────────────────

  ipcMain.handle(IPC.JOBS_SUBMIT, async (_e, job: JobSubmission) => {
    return daemonManager?.request('jobs:submit', job);
  });

  ipcMain.handle(IPC.JOBS_CANCEL, async (_e, jobId: string) => {
    return daemonManager?.request('jobs:cancel', jobId);
  });

  ipcMain.handle(IPC.JOBS_LIST, async (_e, filter?: unknown) => {
    return daemonManager?.request('jobs:list', filter);
  });

  ipcMain.handle(IPC.JOBS_RESULTS, async (_e, jobId: string) => {
    return daemonManager?.request('jobs:results', jobId);
  });

  // ─── Resources ───────────────────────────────────────────────────────────

  ipcMain.handle(IPC.RESOURCES_LOCAL, async () => {
    return daemonManager?.request('resources:local');
  });

  ipcMain.handle(IPC.RESOURCES_POOL, async () => {
    return daemonManager?.request('resources:pool');
  });

  // ─── Usage ───────────────────────────────────────────────────────────────

  ipcMain.handle(IPC.USAGE_SUMMARY, async () => {
    return daemonManager?.request('usage:summary');
  });

  ipcMain.handle(IPC.USAGE_HISTORY, async (_e, days: number) => {
    return daemonManager?.request('usage:history', days);
  });

  // ─── Settings ────────────────────────────────────────────────────────────

  ipcMain.handle(IPC.SETTINGS_GET, async () => {
    return daemonManager?.request('settings:get');
  });

  ipcMain.handle(IPC.SETTINGS_UPDATE, async (_e, settings: Partial<AppSettings>) => {
    return daemonManager?.request('settings:update', settings);
  });

  // ─── Ollama ──────────────────────────────────────────────────────────────

  ipcMain.handle(IPC.OLLAMA_MODELS, async () => {
    return daemonManager?.request('ollama:models');
  });

  ipcMain.handle(IPC.OLLAMA_POOL_MODELS, async () => {
    return daemonManager?.request('ollama:pool-models');
  });

  ipcMain.handle(IPC.OLLAMA_PULL, async (_e, modelName: string) => {
    return daemonManager?.request('ollama:pull', modelName);
  });

  ipcMain.handle(IPC.OLLAMA_STATUS, async () => {
    return daemonManager?.request('ollama:status');
  });

  // ─── System ──────────────────────────────────────────────────────────────

  ipcMain.handle(IPC.APP_SET_DND, async (_e, enabled: boolean) => {
    daemonManager?.send({ type: 'set-dnd', enabled });
  });

  ipcMain.handle(IPC.APP_GET_STATUS, async () => {
    return daemonManager?.request('app:get-status');
  });

  ipcMain.handle(IPC.APP_GET_LOCAL_ADDRESSES, async () => {
    return daemonManager?.request('app:get-local-addresses');
  });
}
