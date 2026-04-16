import { execSync, exec } from 'child_process';
import os from 'os';
import { EventEmitter } from 'events';
import { GPU_POLL_INTERVAL_MS } from '../shared/constants';
import type { ResourceStatus, OwnerActivity } from '../shared/types';

interface GpuInfo {
  model: string;
  totalVramMb: number;
  usedVramMb: number;
  utilizationPct: number;
  temperatureC?: number;
}

export class ResourceMonitor extends EventEmitter {
  private peerId: string;
  private interval: NodeJS.Timeout | null = null;
  private lastResource: ResourceStatus | null = null;
  private gpuPlatform: 'nvidia' | 'amd' | 'apple' | 'none' = 'none';

  constructor(peerId: string) {
    super();
    this.peerId = peerId;
    this.gpuPlatform = this.detectGpuPlatform();
  }

  private detectGpuPlatform(): 'nvidia' | 'amd' | 'apple' | 'none' {
    try {
      execSync('nvidia-smi', { stdio: 'ignore' });
      return 'nvidia';
    } catch {}
    try {
      execSync('rocm-smi', { stdio: 'ignore' });
      return 'amd';
    } catch {}
    if (process.platform === 'darwin') return 'apple';
    return 'none';
  }

  start(): void {
    this.poll();
    this.interval = setInterval(() => this.poll(), GPU_POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  getLatest(): ResourceStatus | null {
    return this.lastResource;
  }

  private async poll(): Promise<void> {
    const gpuInfo = await this.readGpu();
    const resource = this.buildResourceStatus(gpuInfo);
    this.lastResource = resource;
    this.emit('update', resource);
  }

  private async readGpu(): Promise<GpuInfo | null> {
    switch (this.gpuPlatform) {
      case 'nvidia':
        return this.readNvidiaGpu();
      case 'amd':
        return this.readAmdGpu();
      case 'apple':
        return this.readAppleGpu();
      default:
        return null;
    }
  }

  private readNvidiaGpu(): GpuInfo | null {
    try {
      const out = execSync(
        'nvidia-smi --query-gpu=name,memory.used,memory.total,utilization.gpu,temperature.gpu --format=csv,noheader,nounits',
        { encoding: 'utf8', timeout: 5000 }
      ).trim();
      const [name, memUsed, memTotal, util, temp] = out.split(',').map((s) => s.trim());
      return {
        model: name,
        totalVramMb: parseInt(memTotal, 10),
        usedVramMb: parseInt(memUsed, 10),
        utilizationPct: parseInt(util, 10),
        temperatureC: parseInt(temp, 10),
      };
    } catch {
      return null;
    }
  }

  private readAmdGpu(): GpuInfo | null {
    try {
      const out = execSync('rocm-smi --showuse --showmemuse --json', {
        encoding: 'utf8',
        timeout: 5000,
      });
      const data = JSON.parse(out);
      const card = Object.values(data)[0] as Record<string, string>;
      return {
        model: 'AMD GPU',
        totalVramMb: parseInt(card['VRAM Total Memory (B)'] ?? '0', 10) / (1024 * 1024),
        usedVramMb: parseInt(card['VRAM Total Used Memory (B)'] ?? '0', 10) / (1024 * 1024),
        utilizationPct: parseFloat(card['GPU use (%)'] ?? '0'),
      };
    } catch {
      return null;
    }
  }

  private readAppleGpu(): GpuInfo | null {
    // Apple Silicon: approximate GPU info
    // Total unified memory is shared CPU/GPU
    const totalRam = os.totalmem();
    const freeRam = os.freemem();
    return {
      model: 'Apple Silicon (Metal)',
      totalVramMb: Math.round(totalRam / (1024 * 1024)),
      usedVramMb: Math.round((totalRam - freeRam) / (1024 * 1024)),
      utilizationPct: 0, // Load average approximation
    };
  }

  private buildResourceStatus(gpu: GpuInfo | null): ResourceStatus {
    const totalRam = Math.round(os.totalmem() / (1024 * 1024));
    const freeRam = Math.round(os.freemem() / (1024 * 1024));
    const cpus = os.cpus();
    const loadAvg = os.loadavg()[0];
    const idleCpuCores = Math.max(
      0,
      Math.round(cpus.length - loadAvg)
    );

    return {
      peerId: this.peerId,
      gpuModel: gpu?.model ?? 'CPU only',
      totalVramMb: gpu?.totalVramMb ?? 0,
      availableVramMb: gpu ? gpu.totalVramMb - gpu.usedVramMb : 0,
      totalRamMb: totalRam,
      availableRamMb: freeRam,
      totalCpuCores: cpus.length,
      idleCpuCores,
      gpuUtilizationPct: gpu?.utilizationPct ?? 0,
      activity: 'IDLE' as OwnerActivity,
      timestamp: Date.now(),
    };
  }
}
