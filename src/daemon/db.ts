import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';

const DB_DIR = path.join(os.homedir(), '.gpu-coop');
const DB_PATH = path.join(DB_DIR, 'coop.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    fs.mkdirSync(DB_DIR, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    migrate(db);
  }
  return db;
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS peers (
      peer_id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      wireguard_public_key TEXT NOT NULL DEFAULT '',
      endpoint TEXT,
      gpu_model TEXT,
      total_vram_mb INTEGER,
      total_ram_mb INTEGER,
      total_cpu_cores INTEGER,
      last_seen_at INTEGER,
      status TEXT DEFAULT 'offline',
      created_at INTEGER NOT NULL,
      is_local INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS groups (
      group_id TEXT PRIMARY KEY,
      group_name TEXT,
      invite_code TEXT,
      created_at INTEGER NOT NULL,
      is_host INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS jobs (
      job_id TEXT PRIMARY KEY,
      submitter_peer_id TEXT NOT NULL,
      executor_peer_id TEXT,
      job_type TEXT NOT NULL,
      model_name TEXT,
      input_summary TEXT,
      input_count INTEGER,
      status TEXT NOT NULL DEFAULT 'queued',
      priority TEXT DEFAULT 'normal',
      submitted_at INTEGER NOT NULL,
      started_at INTEGER,
      completed_at INTEGER,
      gpu_seconds_used INTEGER DEFAULT 0,
      error_message TEXT
    );

    CREATE TABLE IF NOT EXISTS usage_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      peer_id TEXT NOT NULL,
      direction TEXT NOT NULL,
      gpu_seconds INTEGER NOT NULL DEFAULT 0,
      cpu_seconds INTEGER DEFAULT 0,
      bytes_transferred INTEGER DEFAULT 0,
      job_id TEXT,
      recorded_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS job_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT NOT NULL,
      input_index INTEGER NOT NULL,
      input_text TEXT,
      output_text TEXT,
      tokens_generated INTEGER,
      inference_time_ms INTEGER
    );

    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

// ─── Config helpers ─────────────────────────────────────────────────────────

export function getConfig(key: string): string | null {
  const row = getDb()
    .prepare('SELECT value FROM config WHERE key = ?')
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setConfig(key: string, value: string): void {
  getDb()
    .prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)')
    .run(key, value);
}

// ─── Peer helpers ────────────────────────────────────────────────────────────

export function upsertPeer(peer: {
  peerId: string;
  displayName: string;
  wireguardPublicKey?: string;
  endpoint?: string;
  gpuModel?: string;
  totalVramMb?: number;
  totalRamMb?: number;
  totalCpuCores?: number;
  status?: string;
  isLocal?: number;
}): void {
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO peers
        (peer_id, display_name, wireguard_public_key, endpoint, gpu_model,
         total_vram_mb, total_ram_mb, total_cpu_cores, last_seen_at, status, created_at, is_local)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(peer_id) DO UPDATE SET
         display_name = excluded.display_name,
         endpoint = COALESCE(excluded.endpoint, endpoint),
         gpu_model = COALESCE(excluded.gpu_model, gpu_model),
         total_vram_mb = COALESCE(excluded.total_vram_mb, total_vram_mb),
         total_ram_mb = COALESCE(excluded.total_ram_mb, total_ram_mb),
         total_cpu_cores = COALESCE(excluded.total_cpu_cores, total_cpu_cores),
         last_seen_at = excluded.last_seen_at,
         status = excluded.status`
    )
    .run(
      peer.peerId,
      peer.displayName,
      peer.wireguardPublicKey ?? '',
      peer.endpoint ?? null,
      peer.gpuModel ?? null,
      peer.totalVramMb ?? null,
      peer.totalRamMb ?? null,
      peer.totalCpuCores ?? null,
      now,
      peer.status ?? 'online',
      now,
      peer.isLocal ?? 0
    );
}

export function getPeers(): unknown[] {
  return getDb().prepare('SELECT * FROM peers').all();
}

export function updatePeerStatus(peerId: string, status: string): void {
  getDb()
    .prepare('UPDATE peers SET status = ?, last_seen_at = ? WHERE peer_id = ?')
    .run(status, Date.now(), peerId);
}

// ─── Job helpers ─────────────────────────────────────────────────────────────

export function insertJob(job: {
  jobId: string;
  submitterPeerId: string;
  jobType: string;
  modelName?: string;
  inputSummary?: string;
  inputCount?: number;
  priority: string;
}): void {
  getDb()
    .prepare(
      `INSERT INTO jobs
        (job_id, submitter_peer_id, job_type, model_name, input_summary,
         input_count, status, priority, submitted_at, gpu_seconds_used)
       VALUES (?, ?, ?, ?, ?, ?, 'queued', ?, ?, 0)`
    )
    .run(
      job.jobId,
      job.submitterPeerId,
      job.jobType,
      job.modelName ?? null,
      job.inputSummary ?? null,
      job.inputCount ?? null,
      job.priority,
      Date.now()
    );
}

export function updateJob(
  jobId: string,
  updates: Partial<{
    status: string;
    executorPeerId: string;
    startedAt: number;
    completedAt: number;
    gpuSecondsUsed: number;
    errorMessage: string;
  }>
): void {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [k, v] of Object.entries(updates)) {
    const col = k.replace(/([A-Z])/g, '_$1').toLowerCase();
    sets.push(`${col} = ?`);
    values.push(v);
  }
  values.push(jobId);
  getDb()
    .prepare(`UPDATE jobs SET ${sets.join(', ')} WHERE job_id = ?`)
    .run(...values);
}

export function getJobs(filter?: {
  status?: string;
  submitterPeerId?: string;
}): unknown[] {
  let query = 'SELECT * FROM jobs';
  const params: unknown[] = [];
  const conditions: string[] = [];
  if (filter?.status) {
    conditions.push('status = ?');
    params.push(filter.status);
  }
  if (filter?.submitterPeerId) {
    conditions.push('submitter_peer_id = ?');
    params.push(filter.submitterPeerId);
  }
  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY submitted_at DESC LIMIT 200';
  return getDb().prepare(query).all(...params);
}

export function insertJobResult(result: {
  jobId: string;
  inputIndex: number;
  inputText?: string;
  outputText?: string;
  tokensGenerated?: number;
  inferenceTimeMs?: number;
}): void {
  getDb()
    .prepare(
      `INSERT INTO job_results
        (job_id, input_index, input_text, output_text, tokens_generated, inference_time_ms)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      result.jobId,
      result.inputIndex,
      result.inputText ?? null,
      result.outputText ?? null,
      result.tokensGenerated ?? null,
      result.inferenceTimeMs ?? null
    );
}

export function getJobResults(jobId: string): unknown[] {
  return getDb()
    .prepare('SELECT * FROM job_results WHERE job_id = ? ORDER BY input_index')
    .all(jobId);
}

// ─── Usage ledger ────────────────────────────────────────────────────────────

export function recordUsage(entry: {
  peerId: string;
  direction: 'contributed' | 'consumed';
  gpuSeconds: number;
  cpuSeconds?: number;
  bytesTransferred?: number;
  jobId?: string;
}): void {
  getDb()
    .prepare(
      `INSERT INTO usage_ledger
        (peer_id, direction, gpu_seconds, cpu_seconds, bytes_transferred, job_id, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      entry.peerId,
      entry.direction,
      entry.gpuSeconds,
      entry.cpuSeconds ?? 0,
      entry.bytesTransferred ?? 0,
      entry.jobId ?? null,
      Date.now()
    );
}

export function getUsageSummary(): unknown[] {
  return getDb()
    .prepare(
      `SELECT
        p.peer_id,
        p.display_name,
        COALESCE(SUM(CASE WHEN ul.direction = 'contributed' THEN ul.gpu_seconds ELSE 0 END), 0) AS gpu_seconds_contributed,
        COALESCE(SUM(CASE WHEN ul.direction = 'consumed' THEN ul.gpu_seconds ELSE 0 END), 0) AS gpu_seconds_consumed
       FROM peers p
       LEFT JOIN usage_ledger ul ON ul.peer_id = p.peer_id
       GROUP BY p.peer_id, p.display_name`
    )
    .all();
}

export function getUsageHistory(days: number): unknown[] {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  return getDb()
    .prepare(
      `SELECT
        date(recorded_at / 1000, 'unixepoch') AS date,
        SUM(CASE WHEN direction = 'contributed' THEN gpu_seconds ELSE 0 END) / 3600.0 AS contributed,
        SUM(CASE WHEN direction = 'consumed' THEN gpu_seconds ELSE 0 END) / 3600.0 AS consumed
       FROM usage_ledger
       WHERE recorded_at >= ?
       GROUP BY date
       ORDER BY date`
    )
    .all(since);
}
