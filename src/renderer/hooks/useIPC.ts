// Typed wrapper around window.electronAPI
export function useIPC() {
  const invoke = <T>(channel: string, ...args: unknown[]): Promise<T> => {
    if (!window.electronAPI) {
      return Promise.reject(new Error('electronAPI not available'));
    }
    return window.electronAPI.invoke(channel, ...args) as Promise<T>;
  };

  return { invoke };
}

// Declare the electronAPI shape exposed via preload
declare global {
  interface Window {
    electronAPI: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
      on: (
        channel: string,
        callback: (...args: unknown[]) => void
      ) => () => void;
      removeAllListeners: (channel: string) => void;
    };
  }
}
