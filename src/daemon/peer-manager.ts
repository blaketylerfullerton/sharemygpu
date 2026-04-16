import { EventEmitter } from 'events';
import net from 'net';
import {
  HEALTH_CHECK_INTERVAL_MS,
  HEALTH_CHECK_MAX_FAILURES,
} from '../shared/constants';
import { upsertPeer, getPeers, updatePeerStatus } from './db';
import { GrpcClient } from './grpc-client';
import type { Peer, ResourceStatus } from '../shared/types';

interface RawPeerRow {
  peer_id: string;
  display_name: string;
  wireguard_public_key: string;
  endpoint: string | null;
  gpu_model: string | null;
  total_vram_mb: number | null;
  total_ram_mb: number | null;
  total_cpu_cores: number | null;
  last_seen_at: number | null;
  status: string;
  created_at: number;
  is_local: number;
}

export class PeerManager extends EventEmitter {
  private localPeerId: string;
  private failCounts = new Map<string, number>();
  private healthInterval: NodeJS.Timeout | null = null;
  private peerResources = new Map<string, ResourceStatus>();
  private grpcClients = new Map<string, GrpcClient>(); // peerId → client
  private getLocalResource: () => ResourceStatus | null;

  constructor(localPeerId: string, getLocalResource: () => ResourceStatus | null) {
    super();
    this.localPeerId = localPeerId;
    this.getLocalResource = getLocalResource;
  }

  start(): void {
    this.healthInterval = setInterval(
      () => this.checkHealth(),
      HEALTH_CHECK_INTERVAL_MS
    );
  }

  stop(): void {
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
      this.healthInterval = null;
    }
    // Disconnect all gRPC clients
    for (const client of this.grpcClients.values()) {
      client.disconnect();
    }
    this.grpcClients.clear();
  }

  registerLocalPeer(info: {
    displayName: string;
    gpuModel?: string;
    totalVramMb?: number;
    totalRamMb?: number;
    totalCpuCores?: number;
  }): void {
    upsertPeer({
      peerId: this.localPeerId,
      displayName: info.displayName,
      status: 'idle',
      isLocal: 1,
      gpuModel: info.gpuModel,
      totalVramMb: info.totalVramMb,
      totalRamMb: info.totalRamMb,
      totalCpuCores: info.totalCpuCores,
    });
  }

  updateLocalPeerInfo(resource: ResourceStatus): void {
    upsertPeer({
      peerId: this.localPeerId,
      displayName: '(local)',
      gpuModel: resource.gpuModel,
      totalVramMb: resource.totalVramMb,
      totalRamMb: resource.totalRamMb,
      totalCpuCores: resource.totalCpuCores,
      status: 'idle',
      isLocal: 1,
    });
  }

  getPeers(): Peer[] {
    const rows = getPeers() as RawPeerRow[];
    return rows.map((r) => ({
      peerId: r.peer_id,
      displayName: r.display_name,
      wireguardPublicKey: r.wireguard_public_key,
      endpoint: r.endpoint ?? undefined,
      gpuModel: r.gpu_model ?? undefined,
      totalVramMb: r.total_vram_mb ?? undefined,
      totalRamMb: r.total_ram_mb ?? undefined,
      totalCpuCores: r.total_cpu_cores ?? undefined,
      lastSeenAt: r.last_seen_at ?? undefined,
      status: r.status as Peer['status'],
      createdAt: r.created_at,
      isLocal: r.is_local === 1,
    }));
  }

  /**
   * Connect to a peer by LAN address (e.g. "192.168.1.42:50051").
   * Checks TCP reachability first, then pings via gRPC to verify the service.
   */
  async connectToPeer(address: string): Promise<{ peerId: string; latencyMs: number }> {
    if (!address.includes(':')) {
      address = `${address}:50051`;
    }

    for (const [peerId, client] of this.grpcClients) {
      if (client.getAddress() === address && client.isConnected()) {
        return { peerId, latencyMs: 0 };
      }
    }

    const [host, portStr] = address.split(':');
    const port = parseInt(portStr, 10);

    // Quick TCP check to give a faster, more specific error
    await this.checkTcpReachable(host, port);

    const client = new GrpcClient(address, this.localPeerId);
    client.connect();

    let remotePeerId: string;
    let latencyMs: number;
    try {
      ({ peerId: remotePeerId, latencyMs } = await client.ping());
    } catch (err: any) {
      client.disconnect();
      throw new Error(this.friendlyConnectError(err, address));
    }

    if (remotePeerId === this.localPeerId) {
      client.disconnect();
      throw new Error('Cannot connect to yourself');
    }

    // Clean up any existing client for this peer
    const existing = this.grpcClients.get(remotePeerId);
    if (existing) {
      existing.disconnect();
    }

    this.grpcClients.set(remotePeerId, client);

    // Register the peer in the database
    upsertPeer({
      peerId: remotePeerId,
      displayName: remotePeerId.slice(0, 8),
      endpoint: address,
      status: 'online',
      isLocal: 0,
    });

    this.failCounts.set(remotePeerId, 0);

    // Listen for resource updates from this peer
    client.on('resource', (resource: ResourceStatus) => {
      this.handlePeerResource(remotePeerId, resource);
    });

    client.on('disconnected', () => {
      console.log(`[peer-manager] peer ${remotePeerId} disconnected`);
      this.grpcClients.delete(remotePeerId);
      this.markPeerOffline(remotePeerId);
    });

    // Start the bidirectional resource stream
    client.startResourceStream(this.getLocalResource);

    this.emit('peer:connected', { peerId: remotePeerId, address });
    console.log(`[peer-manager] connected to peer ${remotePeerId} at ${address} (${latencyMs}ms)`);

    return { peerId: remotePeerId, latencyMs };
  }

  /** Called when we receive a resource update from a remote peer (via server or client stream) */
  handlePeerResource(peerId: string, resource: ResourceStatus): void {
    this.peerResources.set(peerId, resource);
    this.failCounts.set(peerId, 0);

    const status = resource.activity === 'HEAVY_USE' || resource.activity === 'DO_NOT_DISTURB'
      ? 'busy'
      : resource.activity === 'IDLE'
      ? 'idle'
      : 'online';

    // Update peer in DB with fresh hardware info
    upsertPeer({
      peerId,
      displayName: peerId.slice(0, 8),
      gpuModel: resource.gpuModel,
      totalVramMb: resource.totalVramMb,
      totalRamMb: resource.totalRamMb,
      totalCpuCores: resource.totalCpuCores,
      status,
      isLocal: 0,
    });

    this.emit('peer:resource-updated', peerId, resource);
  }

  /** Broadcast local resource to all connected peers via gRPC client streams */
  broadcastLocalResource(resource: ResourceStatus): void {
    for (const client of this.grpcClients.values()) {
      client.sendResource(resource);
    }
  }

  markPeerSeen(peerId: string): void {
    this.failCounts.set(peerId, 0);
    updatePeerStatus(peerId, 'online');
  }

  markPeerOffline(peerId: string): void {
    updatePeerStatus(peerId, 'offline');
    this.peerResources.delete(peerId);
    this.emit('peer:disconnected', peerId);
  }

  updatePeerResource(peerId: string, resource: ResourceStatus): void {
    this.peerResources.set(peerId, resource);
    const status = resource.activity === 'HEAVY_USE' || resource.activity === 'DO_NOT_DISTURB'
      ? 'busy'
      : resource.activity === 'IDLE'
      ? 'idle'
      : 'online';
    updatePeerStatus(peerId, status);
  }

  getPeerResources(): ResourceStatus[] {
    return Array.from(this.peerResources.values());
  }

  getConnectedPeerIds(): string[] {
    return Array.from(this.grpcClients.keys());
  }

  private async checkHealth(): Promise<void> {
    for (const [peerId, client] of this.grpcClients) {
      try {
        await client.ping(5000);
        this.failCounts.set(peerId, 0);
        updatePeerStatus(peerId, this.peerResources.has(peerId) ? 'online' : 'idle');
      } catch {
        const fails = (this.failCounts.get(peerId) ?? 0) + 1;
        this.failCounts.set(peerId, fails);
        console.log(`[peer-manager] health check failed for ${peerId} (${fails}/${HEALTH_CHECK_MAX_FAILURES})`);
        if (fails >= HEALTH_CHECK_MAX_FAILURES) {
          console.log(`[peer-manager] marking ${peerId} offline after ${fails} failures`);
          client.disconnect();
          this.grpcClients.delete(peerId);
          this.markPeerOffline(peerId);
        }
      }
    }
  }

  /** Fast TCP probe — fails quickly with a clear message if the host/port is unreachable. */
  private checkTcpReachable(host: string, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      const timeoutMs = 4000;

      socket.setTimeout(timeoutMs);

      socket.on('connect', () => {
        socket.destroy();
        resolve();
      });

      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error(
          `Could not reach ${host}:${port} — connection timed out. ` +
          `Make sure GPU Co-op is running on that machine and the firewall allows incoming connections on port ${port}.`
        ));
      });

      socket.on('error', (err: NodeJS.ErrnoException) => {
        socket.destroy();
        if (err.code === 'ECONNREFUSED') {
          reject(new Error(
            `Connection refused by ${host}:${port}. ` +
            `The machine is reachable but GPU Co-op doesn't appear to be running on port ${port}.`
          ));
        } else if (err.code === 'EHOSTUNREACH' || err.code === 'ENETUNREACH') {
          reject(new Error(
            `Host ${host} is unreachable. Check that both machines are on the same network.`
          ));
        } else {
          reject(new Error(
            `Could not connect to ${host}:${port} (${err.code ?? err.message}). ` +
            `Verify the IP address and that GPU Co-op is running on that machine.`
          ));
        }
      });

      socket.connect(port, host);
    });
  }

  /** Translate raw gRPC errors into actionable messages. */
  private friendlyConnectError(err: any, address: string): string {
    const code = err?.code;
    const msg = err?.message ?? String(err);

    if (code === 4 || msg.includes('DEADLINE_EXCEEDED')) {
      return (
        `Connection to ${address} timed out. ` +
        `The remote machine may not be running GPU Co-op, or a firewall is blocking port ${address.split(':')[1] ?? '50051'}.`
      );
    }
    if (code === 14 || msg.includes('UNAVAILABLE')) {
      return `Could not reach GPU Co-op at ${address}. Is the app running on that machine?`;
    }
    if (code === 13 || msg.includes('INTERNAL')) {
      return `The peer at ${address} returned an internal error. It may be running an incompatible version.`;
    }
    return `Connection to ${address} failed: ${msg}`;
  }
}
