import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { EventEmitter } from 'events';
import type { ResourceStatus } from '../shared/types';

const PROTO_PATH = path.join(__dirname, '../proto/coop.proto');

let cachedProto: any = null;

function getProto() {
  if (!cachedProto) {
    const packageDef = protoLoader.loadSync(PROTO_PATH, {
      keepCase: false,
      longs: Number,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    cachedProto = grpc.loadPackageDefinition(packageDef) as any;
  }
  return cachedProto;
}

export class GrpcClient extends EventEmitter {
  private address: string;
  private client: any = null;
  private resourceStream: grpc.ClientDuplexStream<any, any> | null = null;
  private localPeerId: string;
  private connected = false;

  constructor(address: string, localPeerId: string) {
    super();
    this.address = address;
    this.localPeerId = localPeerId;
  }

  connect(): void {
    const proto = getProto();
    const CoopService = proto.gpucoop.CoopService;

    this.client = new CoopService(
      this.address,
      grpc.credentials.createInsecure(),
      {
        'grpc.keepalive_time_ms': 30_000,
        'grpc.keepalive_timeout_ms': 10_000,
      }
    );

    console.log(`[grpc-client] connecting to ${this.address}`);
  }

  disconnect(): void {
    if (this.resourceStream) {
      try { this.resourceStream.end(); } catch {}
      this.resourceStream = null;
    }
    if (this.client) {
      this.client.close();
      this.client = null;
    }
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getAddress(): string {
    return this.address;
  }

  async ping(timeoutMs = 10_000): Promise<{ peerId: string; latencyMs: number }> {
    if (!this.client) throw new Error('Not connected');

    return new Promise((resolve, reject) => {
      const start = Date.now();
      this.client.Ping(
        { timestamp: start, peerId: this.localPeerId },
        { deadline: new Date(Date.now() + timeoutMs) },
        (err: any, response: any) => {
          if (err) {
            reject(err);
          } else {
            this.connected = true;
            resolve({
              peerId: response.peerId,
              latencyMs: Date.now() - start,
            });
          }
        }
      );
    });
  }

  /**
   * Start a bidirectional resource stream.
   * Sends our resource status, receives theirs.
   * Emits 'resource' event with ResourceStatus when we get an update from the peer.
   */
  startResourceStream(getLocalResource: () => ResourceStatus | null): void {
    if (!this.client) throw new Error('Not connected');
    if (this.resourceStream) return; // already streaming

    this.resourceStream = this.client.ResourceStream();

    this.resourceStream!.on('data', (msg: any) => {
      const resource = this.protoToResource(msg);
      this.emit('resource', resource);
    });

    this.resourceStream!.on('error', (err: any) => {
      if (err.code !== grpc.status.CANCELLED) {
        console.log(`[grpc-client] resource stream error from ${this.address}:`, err.message);
      }
      this.resourceStream = null;
      this.connected = false;
      this.emit('disconnected');
    });

    this.resourceStream!.on('end', () => {
      console.log(`[grpc-client] resource stream ended from ${this.address}`);
      this.resourceStream = null;
      this.connected = false;
      this.emit('disconnected');
    });

    // Send initial resource status
    const local = getLocalResource();
    if (local) {
      this.sendResource(local);
    }
  }

  /** Send a resource update to the remote peer */
  sendResource(resource: ResourceStatus): void {
    if (!this.resourceStream) return;
    try {
      this.resourceStream.write(this.resourceToProto(resource));
    } catch {}
  }

  // ── Proto conversion helpers ───────────────────────────────────────────────

  private activityStringToEnum(activity: string): number {
    switch (activity) {
      case 'IDLE': return 0;
      case 'LIGHT_USE': return 1;
      case 'HEAVY_USE': return 2;
      case 'DO_NOT_DISTURB': return 3;
      default: return 0;
    }
  }

  private activityEnumToString(val: number | string): string {
    if (typeof val === 'string') return val;
    switch (val) {
      case 0: return 'IDLE';
      case 1: return 'LIGHT_USE';
      case 2: return 'HEAVY_USE';
      case 3: return 'DO_NOT_DISTURB';
      default: return 'IDLE';
    }
  }

  private resourceToProto(r: ResourceStatus): Record<string, unknown> {
    return {
      peerId: r.peerId,
      gpuModel: r.gpuModel,
      totalVramMb: r.totalVramMb,
      availableVramMb: r.availableVramMb,
      totalRamMb: r.totalRamMb,
      availableRamMb: r.availableRamMb,
      totalCpuCores: r.totalCpuCores,
      idleCpuCores: r.idleCpuCores,
      activity: this.activityStringToEnum(r.activity),
      timestamp: r.timestamp,
      gpuUtilizationPct: r.gpuUtilizationPct,
    };
  }

  private protoToResource(msg: any): ResourceStatus {
    return {
      peerId: msg.peerId || '',
      hostname: msg.hostname || '',
      gpuModel: msg.gpuModel || 'Unknown',
      totalVramMb: msg.totalVramMb || 0,
      availableVramMb: msg.availableVramMb || 0,
      totalRamMb: msg.totalRamMb || 0,
      availableRamMb: msg.availableRamMb || 0,
      totalCpuCores: msg.totalCpuCores || 0,
      idleCpuCores: msg.idleCpuCores || 0,
      gpuUtilizationPct: msg.gpuUtilizationPct || 0,
      activity: this.activityEnumToString(msg.activity) as ResourceStatus['activity'],
      timestamp: msg.timestamp || Date.now(),
    };
  }
}
