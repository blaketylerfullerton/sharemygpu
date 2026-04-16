import { contextBridge, ipcRenderer } from 'electron';

// Inlined to avoid requiring a local module in the sandboxed preload context.
// Must stay in sync with IPC_EVENTS in src/shared/ipc-channels.ts.
const VALID_EVENTS = new Set([
  'peer:connected',
  'peer:disconnected',
  'peer:status-changed',
  'job:status-changed',
  'job:progress',
  'job:completed',
  'job:preempted',
  'resource:updated',
  'ollama:status-changed',
  'daemon:status-changed',
]);

// Expose a safe bridge to the renderer
contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel: string, ...args: unknown[]) =>
    ipcRenderer.invoke(channel, ...args),

  on: (channel: string, callback: (...args: unknown[]) => void) => {
    if (!VALID_EVENTS.has(channel)) {
      console.warn(`[preload] Blocked unknown event channel: ${channel}`);
      return () => {};
    }
    const listener = (_event: Electron.IpcRendererEvent, ...args: unknown[]) =>
      callback(...args);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },

  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
});
