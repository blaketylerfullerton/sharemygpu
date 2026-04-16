import { useEffect, useCallback } from 'react';
import { useStore } from '../store';
import { useIPC } from './useIPC';
import { IPC, IPC_EVENTS } from '../../shared/ipc-channels';
import type { Peer, ResourceStatus } from '../../shared/types';

const noop = () => {};

function safeOn(channel: string, cb: (...args: unknown[]) => void): () => void {
  if (!window.electronAPI) return noop;
  return window.electronAPI.on(channel, cb);
}

export function usePeers() {
  const { invoke } = useIPC();
  const { setPeers, updatePeer, updatePeerResource, setLocalResource } =
    useStore();

  const refresh = useCallback(async () => {
    try {
      const [peers, localResource, poolResources] = await Promise.all([
        invoke<Peer[]>(IPC.PEERS_LIST),
        invoke<ResourceStatus>(IPC.RESOURCES_LOCAL),
        invoke<ResourceStatus[]>(IPC.RESOURCES_POOL),
      ]);
      if (peers) setPeers(peers);
      if (localResource) setLocalResource(localResource);
      if (poolResources) {
        poolResources.forEach((r) => updatePeerResource(r.peerId, r));
      }
    } catch {
      // Daemon not ready yet
    }
  }, [invoke, setPeers, setLocalResource, updatePeerResource]);

  useEffect(() => {
    refresh();

    const offConnected = safeOn(IPC_EVENTS.PEER_CONNECTED, () => refresh());
    const offDisconnected = safeOn(IPC_EVENTS.PEER_DISCONNECTED, (peerId) => {
      updatePeer(peerId as string, { status: 'offline' });
    });
    const offStatusChanged = safeOn(IPC_EVENTS.PEER_STATUS_CHANGED, (data) => {
      const { peerId, status } = data as { peerId: string; status: Peer['status'] };
      updatePeer(peerId, { status });
    });
    const offResourceUpdated = safeOn(IPC_EVENTS.RESOURCE_UPDATED, (data) => {
      const r = data as ResourceStatus;
      updatePeerResource(r.peerId, r);
    });

    const interval = setInterval(refresh, 15_000);

    return () => {
      offConnected();
      offDisconnected();
      offStatusChanged();
      offResourceUpdated();
      clearInterval(interval);
    };
  }, [refresh, updatePeer, updatePeerResource]);

  return { refresh };
}
