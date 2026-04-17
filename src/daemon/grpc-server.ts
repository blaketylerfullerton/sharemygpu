import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { GRPC_DEFAULT_PORT } from '../shared/constants';
import type { ResourceStatus } from '../shared/types';

const PROTO_PATH = path.join(__dirname, '../proto/coop.proto');

type ResourceCallback = (resource: ResourceStatus) => void;

export class GrpcServer {
  private server: grpc.Server;
  private port: number;
  private localPeerId: string;
  private getLocalResource: () => ResourceStatus | null;
  private onPeerResource: ResourceCallback;
  private resourceStreams = new Map<string, grpc.ServerDuplexStream<unknown, unknown>>();

  constructor(opts: {
    port?: number;
    localPeerId: string;
    getLocalResource: () => ResourceStatus | null;
    onPeerResource: ResourceCallback;
  }) {
    this.port = opts.port ?? GRPC_DEFAULT_PORT;
    this.localPeerId = opts.localPeerId;
    this.getLocalResource = opts.getLocalResource;
    this.onPeerResource = opts.onPeerResource;
    this.server = new grpc.Server();
  }

  async start(): Promise<number> {
    const packageDef = protoLoader.loadSync(PROTO_PATH, {
      keepCase: false,
      longs: Number,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    const proto = grpc.loadPackageDefinition(packageDef) as any;
    const CoopService = proto.gpucoop.CoopService;

    this.server.addService(CoopService.service, {
      Ping: this.handlePing.bind(this),
      ResourceStream: this.handleResourceStream.bind(this),
      SubmitJob: this.handleUnimplemented.bind(this),
      CancelJob: this.handleUnimplemented.bind(this),
      GetJobStatus: this.handleUnimplemented.bind(this),
      TransferData: this.handleUnimplementedStream.bind(this),
    });

    return new Promise((resolve, reject) => {
      this.server.bindAsync(
        `0.0.0.0:${this.port}`,
        grpc.ServerCredentials.createInsecure(),
        (err, boundPort) => {
          if (err) {
            reject(err);
          } else {
            console.log(`[grpc] server listening on :${boundPort}`);
            resolve(boundPort);
          }
        }
      );
    });
  }

  /** Push a resource update to all connected peer streams */
  broadcastResource(resource: ResourceStatus): void {
    const msg = this.resourceToProto(resource);
    for (const [peerId, stream] of this.resourceStreams) {
      try {
        stream.write(msg);
      } catch {
        this.resourceStreams.delete(peerId);
      }
    }
  }

  stop(): void {
    for (const stream of this.resourceStreams.values()) {
      try { stream.end(); } catch {}
    }
    this.resourceStreams.clear();
    this.server.forceShutdown();
  }

  // ── Handlers ────────────────────────────────────────────────────────────────

  private handlePing(
    call: grpc.ServerUnaryCall<any, any>,
    callback: grpc.sendUnaryData<any>
  ): void {
    const req = call.request;
    console.log(`[grpc] ping from ${req.peerId || 'unknown'}`);
    callback(null, {
      timestamp: Date.now(),
      peerId: this.localPeerId,
      latencyMs: Date.now() - (req.timestamp || Date.now()),
    });
  }

  private handleResourceStream(
    call: grpc.ServerDuplexStream<any, any>
  ): void {
    let remotePeerId = 'unknown';

    call.on('data', (msg: any) => {
      remotePeerId = msg.peerId || remotePeerId;
      this.resourceStreams.set(remotePeerId, call);

      // Convert proto message to our ResourceStatus type
      const resource = this.protoToResource(msg);
      this.onPeerResource(resource);

      // Send back our current resource status
      const local = this.getLocalResource();
      if (local) {
        try {
          call.write(this.resourceToProto(local));
        } catch {}
      }
    });

    call.on('end', () => {
      console.log(`[grpc] resource stream ended from ${remotePeerId}`);
      this.resourceStreams.delete(remotePeerId);
      call.end();
    });

    call.on('error', (err: any) => {
      if (err.code !== grpc.status.CANCELLED) {
        console.log(`[grpc] resource stream error from ${remotePeerId}:`, err.message);
      }
      this.resourceStreams.delete(remotePeerId);
    });
  }

  private handleUnimplemented(
    _call: grpc.ServerUnaryCall<any, any>,
    callback: grpc.sendUnaryData<any>
  ): void {
    callback({
      code: grpc.status.UNIMPLEMENTED,
      message: 'Not yet implemented',
    });
  }

  private handleUnimplementedStream(
    call: grpc.ServerReadableStream<any, any>,
    callback: grpc.sendUnaryData<any>
  ): void {
    call.on('data', () => {});
    call.on('end', () => {
      callback({
        code: grpc.status.UNIMPLEMENTED,
        message: 'Not yet implemented',
      });
    });
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
