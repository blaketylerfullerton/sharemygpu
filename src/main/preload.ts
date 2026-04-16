import { contextBridge, ipcRenderer } from 'electron';
import { IPC_EVENTS } from '../shared/ipc-channels';

// Expose a safe bridge to the renderer
contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel: string, ...args: unknown[]) =>
    ipcRenderer.invoke(channel, ...args),

  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const validEvents = Object.values(IPC_EVENTS) as string[];
    if (!validEvents.includes(channel)) {
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
