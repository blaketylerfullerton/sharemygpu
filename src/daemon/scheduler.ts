import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { OllamaClient } from './ollama-client';
import {
  insertJob,
  updateJob,
  getJobs,
  insertJobResult,
  recordUsage,
} from './db';
import type { Job, JobSubmission, ResourceStatus } from '../shared/types';

interface ActiveJob {
  jobId: string;
  submitterPeerId: string;
  abortController: AbortController;
  startedAt: number;
}

export class Scheduler extends EventEmitter {
  private localPeerId: string;
  private ollama: OllamaClient;
  private activeJobs = new Map<string, ActiveJob>();
  private peerResources = new Map<string, ResourceStatus>();

  constructor(localPeerId: string, ollama: OllamaClient) {
    super();
    this.localPeerId = localPeerId;
    this.ollama = ollama;
  }

  updatePeerResource(peerId: string, resource: ResourceStatus): void {
    this.peerResources.set(peerId, resource);
  }

  async submitJob(submission: JobSubmission, submitterPeerId: string): Promise<string> {
    const jobId = uuidv4();
    insertJob({
      jobId,
      submitterPeerId,
      jobType: submission.jobType,
      modelName: submission.modelName,
      inputSummary: `${submission.prompts.length} prompt(s) — ${submission.modelName}`,
      inputCount: submission.prompts.length,
      priority: submission.priority,
    });

    this.emit('job:status-changed', { jobId, status: 'queued' });

    // Dispatch asynchronously
    this.dispatchJob(jobId, submission).catch((err) => {
      console.error('[scheduler] job error:', err);
      updateJob(jobId, { status: 'failed', errorMessage: String(err) });
      this.emit('job:status-changed', { jobId, status: 'failed' });
    });

    return jobId;
  }

  private async dispatchJob(jobId: string, submission: JobSubmission): Promise<void> {
    // For MVP: run locally via Ollama
    const abortController = new AbortController();
    this.activeJobs.set(jobId, {
      jobId,
      submitterPeerId: this.localPeerId,
      abortController,
      startedAt: Date.now(),
    });

    updateJob(jobId, {
      status: 'running',
      executorPeerId: this.localPeerId,
      startedAt: Date.now(),
    });
    this.emit('job:status-changed', { jobId, status: 'running' });

    try {
      const total = submission.prompts.length;
      let done = 0;

      for (let i = 0; i < total; i++) {
        if (abortController.signal.aborted) {
          throw new Error('Job cancelled');
        }

        const t0 = Date.now();
        const result = await this.ollama.generate({
          model: submission.modelName,
          prompt: submission.prompts[i],
          stream: false,
        });

        insertJobResult({
          jobId,
          inputIndex: i,
          inputText: submission.prompts[i],
          outputText: result.response,
          tokensGenerated: result.tokensGenerated,
          inferenceTimeMs: result.durationMs,
        });

        done++;
        const progress = Math.round((done / total) * 100);
        this.emit('job:progress', { jobId, progress });
      }

      const active = this.activeJobs.get(jobId);
      const gpuSecs = active ? Math.round((Date.now() - active.startedAt) / 1000) : 0;

      updateJob(jobId, {
        status: 'completed',
        completedAt: Date.now(),
        gpuSecondsUsed: gpuSecs,
      });

      // Record usage
      recordUsage({
        peerId: this.localPeerId,
        direction: 'consumed',
        gpuSeconds: gpuSecs,
        jobId,
      });

      this.activeJobs.delete(jobId);
      this.emit('job:completed', { jobId });
      this.emit('job:status-changed', { jobId, status: 'completed' });
    } catch (err) {
      this.activeJobs.delete(jobId);
      const msg = String(err);
      if (msg.includes('cancelled')) {
        updateJob(jobId, { status: 'cancelled', completedAt: Date.now() });
        this.emit('job:status-changed', { jobId, status: 'cancelled' });
      } else {
        updateJob(jobId, { status: 'failed', errorMessage: msg, completedAt: Date.now() });
        this.emit('job:status-changed', { jobId, status: 'failed' });
      }
      throw err;
    }
  }

  cancelJob(jobId: string): void {
    const active = this.activeJobs.get(jobId);
    if (active) {
      active.abortController.abort();
      this.activeJobs.delete(jobId);
    }
  }

  preemptAllRemoteJobs(): void {
    for (const [jobId, active] of this.activeJobs) {
      active.abortController.abort();
      updateJob(jobId, { status: 'preempted', completedAt: Date.now() });
      this.emit('job:preempted', { jobId, reason: 'Owner needs GPU' });
      this.emit('job:status-changed', { jobId, status: 'preempted' });
    }
    this.activeJobs.clear();
  }

  getJobs(): unknown[] {
    return getJobs();
  }
}
