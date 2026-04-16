# CLAUDE.md — GPU Co-op: Peer-to-Peer Compute Sharing for Friends

## Project Vision

GPU Co-op is a cross-platform desktop app that lets friends pool their GPU and CPU resources into a shared compute cluster. Users install the app, share an invite link, and their machines form a persistent, encrypted mesh network. When one person needs to run an LLM inference job, a batch processing task, or any GPU workload, the system automatically dispatches it to whichever machine in the pool has spare capacity — transparently and securely.

The core insight: most consumer GPUs sit idle 90%+ of the time. GPU Co-op turns a group of friends' hardware into a shared supercomputer that any member can use on demand.

**This is NOT:** Exo (synchronous model splitting), Petals (public volunteer network), or a crypto mining pool. This is a private, trust-based compute co-op between people who know each other.

---

## Core User Experience

### First Launch (Host)
1. User installs the app on Mac, Windows, or Linux
2. App detects local hardware (GPU model, VRAM, CPU cores, RAM)
3. User clicks "Create Group" → gets an invite link (short URL or QR code)
4. App starts background daemon, begins advertising resources

### First Launch (Joiner)
1. User clicks invite link or pastes invite code
2. App installs, auto-configures, connects to the group
3. Both machines appear in each other's dashboard within seconds
4. Pool is live — both users can now submit jobs

### Ongoing Usage
- App runs in system tray (background daemon always on)
- Dashboard shows: pool members, their hardware, availability, job queue, usage ledger
- User submits a job (e.g., "run inference on this batch with Llama 3 70B")
- System checks which machines have capacity, dispatches work
- Owner's local usage always takes priority — if they start gaming, loaned compute pauses gracefully
- Usage ledger tracks GPU-hours contributed vs consumed (no real money, just fairness visibility)

---

## Technical Architecture

### Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Desktop framework | Electron | Cross-platform (Mac/Win/Linux), mature ecosystem, large community |
| Frontend | React + TypeScript | Dashboard UI, settings, job submission |
| Main process | Node.js (Electron main) | System tray, IPC, auto-updates, spawns daemon |
| Background daemon | Node.js (child_process.fork) | Must survive window close. Handles scheduling, monitoring, peer communication |
| Networking | WireGuard (embedded via userspace implementation) | Encrypted peer-to-peer mesh. Fallback: allow Tailscale integration for MVP |
| Peer communication | gRPC over WireGuard tunnel | Bidirectional streaming for job dispatch, status updates, resource advertising |
| Inference backend | Ollama (HTTP API) | Do NOT build inference. Shell out to Ollama running locally on each machine |
| Coordination server | Cloudflare Worker (lightweight) | Only for invite code exchange and initial peer discovery. NOT in the data path |
| Database (local) | SQLite via better-sqlite3 | Job history, usage ledger, peer info, local config |

### Process Architecture

```
┌─────────────────────────────────────────────────┐
│ Electron App                                     │
│                                                  │
│  ┌──────────────┐    IPC     ┌────────────────┐ │
│  │ Renderer     │◄─────────►│ Main Process   │ │
│  │ (React UI)   │           │ (tray, updates)│ │
│  └──────────────┘           └───────┬────────┘ │
│                                     │ fork()    │
│                               ┌─────▼────────┐ │
│                               │ Daemon       │ │
│                               │ (long-lived) │ │
│                               └─────┬────────┘ │
└─────────────────────────────────────┼───────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                  │
              ┌─────▼─────┐   ┌──────▼──────┐   ┌──────▼──────┐
              │ WireGuard  │   │ GPU Monitor │   │ Ollama API  │
              │ Tunnel     │   │ (nvidia-smi)│   │ (localhost) │
              └─────┬──────┘   └─────────────┘   └─────────────┘
                    │
                    │ gRPC
                    │
              ┌─────▼──────┐
              │ Peer's     │
              │ Daemon     │
              └────────────┘
```

### Daemon Responsibilities

The daemon is the heart of the system. It runs as a forked Node.js process from the Electron main process. It must:

1. **Resource monitoring** — Poll GPU utilization (nvidia-smi / rocm-smi / Metal Performance Shaders), CPU load, available RAM, and VRAM every 5 seconds. Detect when the owner is actively using the GPU (gaming, local inference, rendering) and flag the machine as "busy."

2. **Resource advertising** — Broadcast current availability to all peers via gRPC stream. Message includes: available VRAM (MB), available RAM (MB), idle CPU cores, GPU model, estimated compute capability, and owner activity state (idle/light/busy).

3. **Job scheduling** — Maintain a priority queue of pending jobs. When a job is submitted, evaluate all peers' advertised resources, select the best target (or split across multiple if needed), and dispatch. Local jobs from the machine owner always preempt remote jobs.

4. **Preemption handling** — If a machine's owner starts using their GPU while a remote job is running, the daemon must: (a) pause the remote job gracefully, (b) notify the job submitter, (c) resume or relocate the job when resources free up. Checkpointing is ideal but not required for MVP — just kill and restart.

5. **Usage ledger** — Track GPU-hours, CPU-hours, and data transferred for each peer. Store in local SQLite. No billing — just a fairness dashboard so people can see if the sharing is roughly balanced.

6. **Health checks** — Ping peers every 30 seconds. If a peer is unreachable for 3 consecutive checks, mark them offline. When they reconnect, sync state.

### Networking Architecture

#### Invite Flow (Coordination Server)

The coordination server is a minimal Cloudflare Worker that facilitates initial peer discovery. It is NOT in the data path after connection is established.

```
Host creates group:
1. Generate group_id (UUID v4)
2. Generate WireGuard keypair locally
3. POST to coordination server: { group_id, public_key, endpoint_hint }
4. Server returns invite_code (short alphanumeric, e.g., "ABC-XYZ-123")
5. Host shares invite_code with friend

Friend joins group:
1. Enter invite_code in app
2. App generates its own WireGuard keypair
3. POST to coordination server: { invite_code, public_key, endpoint_hint }
4. Server returns host's public_key and endpoint_hint
5. Both peers now have each other's WireGuard public keys
6. Direct WireGuard tunnel established
7. Coordination server data expires after 24 hours (ephemeral)
```

#### WireGuard Mesh

Each peer-to-peer connection is a WireGuard tunnel. For N peers, each peer maintains N-1 tunnels (full mesh). This is fine for small groups (2-10 people). Use a userspace WireGuard implementation to avoid requiring root/admin privileges:

- **Option A (MVP):** Use Tailscale as external dependency. Users install Tailscale separately, the app discovers peers via Tailscale API. Simpler but adds a dependency.
- **Option B (Production):** Embed `boringtun` (Cloudflare's userspace WireGuard in Rust) as a native Node addon. Self-contained but harder to build.
- **Recommendation:** Start with Option A, migrate to Option B later.

#### Peer Communication Protocol (gRPC)

All peer-to-peer communication happens over gRPC on top of the WireGuard tunnel.

```protobuf
syntax = "proto3";

package gpucoop;

// Resource advertising
message ResourceStatus {
  string peer_id = 1;
  string gpu_model = 2;
  int32 total_vram_mb = 3;
  int32 available_vram_mb = 4;
  int32 total_ram_mb = 5;
  int32 available_ram_mb = 6;
  int32 total_cpu_cores = 7;
  int32 idle_cpu_cores = 8;
  OwnerActivity activity = 9;
  int64 timestamp = 10;
}

enum OwnerActivity {
  IDLE = 0;
  LIGHT_USE = 1;
  HEAVY_USE = 2;
  DO_NOT_DISTURB = 3;
}

// Job management
message Job {
  string job_id = 1;
  string submitter_peer_id = 2;
  JobType type = 3;
  string model_name = 4;         // e.g., "llama3:70b"
  repeated string input_refs = 5; // references to input data
  JobPriority priority = 6;
  int64 submitted_at = 7;
}

enum JobType {
  LLM_BATCH_INFERENCE = 0;
  LLM_SINGLE_INFERENCE = 1;
  CUSTOM_CONTAINER = 2;         // future: arbitrary Docker workloads
}

enum JobPriority {
  LOW = 0;
  NORMAL = 1;
  HIGH = 2;
}

message JobResult {
  string job_id = 1;
  JobStatus status = 2;
  string output_ref = 3;         // reference to output data
  string error_message = 4;
  int64 gpu_seconds_used = 5;
  int64 completed_at = 6;
}

enum JobStatus {
  QUEUED = 0;
  RUNNING = 1;
  COMPLETED = 2;
  FAILED = 3;
  PREEMPTED = 4;
  CANCELLED = 5;
}

// Peer services
service CoopService {
  // Bidirectional resource status stream
  rpc ResourceStream (stream ResourceStatus) returns (stream ResourceStatus);

  // Job lifecycle
  rpc SubmitJob (Job) returns (JobResult);
  rpc CancelJob (CancelRequest) returns (JobResult);
  rpc GetJobStatus (JobStatusRequest) returns (JobResult);

  // Health
  rpc Ping (PingRequest) returns (PingResponse);

  // Data transfer (for sending input/output payloads)
  rpc TransferData (stream DataChunk) returns (TransferAck);
}

message DataChunk {
  string transfer_id = 1;
  bytes data = 2;
  int64 offset = 3;
  int64 total_size = 4;
}

message CancelRequest { string job_id = 1; }
message JobStatusRequest { string job_id = 1; }
message PingRequest { int64 timestamp = 1; }
message PingResponse { int64 timestamp = 1; string peer_id = 2; }
message TransferAck { string transfer_id = 1; bool success = 2; }
```

### Inference Integration

GPU Co-op does NOT run inference itself. It manages and dispatches jobs to Ollama running locally on each machine.

#### Ollama Integration

Each machine in the pool must have Ollama installed. The daemon communicates with Ollama via its HTTP API (default: `http://localhost:11434`).

Key Ollama API endpoints used:
- `GET /api/tags` — list locally available models
- `POST /api/pull` — pull a model (if worker doesn't have it)
- `POST /api/generate` — run inference (streaming)
- `POST /api/chat` — chat completion (streaming)

#### Job Dispatch Flow

```
1. User submits job: "Run llama3:70b on these 200 prompts"
2. Daemon checks: which peers are idle and have enough VRAM for llama3:70b?
3. If the model requires more VRAM than any single peer has:
   a. Check if Ollama on that peer supports CPU offloading for remaining layers
   b. If no peer can handle it, report error with explanation
4. If multiple peers are available, split the batch:
   a. Peer A gets prompts 1-100, Peer B gets prompts 101-200
   b. Transfer input data via gRPC TransferData stream
   c. Each peer runs Ollama generate locally
   d. Results stream back as they complete
5. Daemon aggregates results, stores in local SQLite, notifies user
6. Usage ledger updated: Peer A contributed X GPU-seconds, Peer B contributed Y
```

#### Model Management

- The app should show which models each peer has available
- If a job requires a model a peer doesn't have, offer to auto-pull it
- Track model storage usage per peer in the dashboard

### GPU Monitoring

Platform-specific GPU monitoring:

```
NVIDIA (Linux/Windows):
  nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu,name --format=csv,noheader,nounits
  Poll every 5 seconds

AMD (Linux):
  rocm-smi --showuse --showmemuse --showtemp --json
  Poll every 5 seconds

Apple Silicon (macOS):
  Use child_process to run: sudo powermetrics --samplers gpu_power -i 5000 -n 1
  Or use the Metal Performance Shaders framework via a native addon
  For MVP: approximate via Activity Monitor data using `ps` commands

CPU (all platforms):
  Use os.cpus() and os.loadavg() from Node.js
  Available RAM: os.freemem()
```

#### Idle Detection Heuristic

A machine is considered "idle" and available for remote work when:
- GPU utilization < 10% for 60 consecutive seconds
- No fullscreen application is running (heuristic for gaming)
- User has not set "Do Not Disturb" mode in the app
- Screen saver is active OR no mouse/keyboard input for 5+ minutes (optional, user-configurable)

A machine is "busy" and should NOT accept new remote work when:
- GPU utilization > 50%
- A fullscreen app is detected
- User manually set DND mode

Transition from idle to busy should preempt running remote jobs with a 30-second grace period.

---

## Frontend (React Dashboard)

### Pages / Views

1. **Pool Overview (Home)**
   - List of all group members with status indicators (online/idle/busy/offline)
   - Each member shows: GPU model, available VRAM, current activity
   - Total pool capacity summary at top
   - Quick-submit job button

2. **Job Queue**
   - Active jobs with progress bars
   - Pending jobs in queue
   - Completed job history with results
   - Cancel/retry controls
   - Filter by: my jobs, all jobs, status

3. **Submit Job**
   - Select job type (batch inference, single prompt, custom)
   - Select or enter model name (autocomplete from available models across pool)
   - Input: paste prompts, upload file (CSV/JSONL), or enter single prompt
   - Advanced: set priority, select preferred peers, set timeout
   - Estimate: show which peers would handle this and approximate time

4. **Usage Ledger**
   - Per-peer breakdown: GPU-hours contributed, GPU-hours consumed
   - Net balance (contributed - consumed)
   - Time-series chart of usage over past 30 days
   - Totally informational — no enforcement, just visibility

5. **Settings**
   - Network: show WireGuard/Tailscale status, peer connections
   - Resource limits: max VRAM to share, max CPU cores to share, quiet hours
   - Notifications: job complete, peer joined/left, preemption events
   - Ollama: path to Ollama binary, API port
   - Group management: invite new member, leave group, view invite code

### System Tray

- Icon changes color based on state:
  - Green: idle, accepting remote jobs
  - Yellow: light use, still accepting
  - Red: busy, not accepting
  - Gray: disconnected or daemon not running
- Right-click menu:
  - Show dashboard
  - Quick status (peers online, jobs running)
  - Do Not Disturb toggle
  - Quit

### UI Framework & Styling

- Use React with TypeScript
- Styling: Tailwind CSS
- Component library: Shadcn/ui (for polished, accessible components)
- Charts: Recharts (for usage ledger visualizations)
- Icons: Lucide React
- State management: Zustand (lightweight, good for Electron IPC patterns)
- IPC communication: Use Electron's ipcMain/ipcRenderer with typed channels

---

## Project Structure

```
gpu-coop/
├── CLAUDE.md                          # This file
├── package.json
├── electron-builder.yml               # Build config for Mac/Win/Linux
├── tsconfig.json
│
├── src/
│   ├── main/                          # Electron main process
│   │   ├── index.ts                   # App entry, window creation, tray
│   │   ├── tray.ts                    # System tray icon and menu
│   │   ├── ipc.ts                     # IPC handler registration
│   │   ├── updater.ts                 # Auto-update logic
│   │   └── daemon.ts                  # Fork and manage daemon process
│   │
│   ├── daemon/                        # Background daemon (forked process)
│   │   ├── index.ts                   # Daemon entry point
│   │   ├── scheduler.ts              # Job queue and dispatch logic
│   │   ├── resource-monitor.ts       # GPU/CPU/RAM monitoring
│   │   ├── idle-detector.ts          # Owner activity detection
│   │   ├── peer-manager.ts           # Manage peer connections
│   │   ├── grpc-server.ts            # gRPC service implementation
│   │   ├── grpc-client.ts            # gRPC client for connecting to peers
│   │   ├── ollama-client.ts          # HTTP client for local Ollama API
│   │   ├── usage-ledger.ts           # Track and store usage stats
│   │   ├── data-transfer.ts          # Chunked data transfer logic
│   │   └── db.ts                     # SQLite database setup and queries
│   │
│   ├── renderer/                      # React frontend
│   │   ├── App.tsx                    # Root component, routing
│   │   ├── main.tsx                   # Renderer entry point
│   │   ├── pages/
│   │   │   ├── PoolOverview.tsx       # Home / pool status
│   │   │   ├── JobQueue.tsx           # Job list and management
│   │   │   ├── SubmitJob.tsx          # Job submission form
│   │   │   ├── UsageLedger.tsx        # Usage tracking charts
│   │   │   └── Settings.tsx           # App configuration
│   │   ├── components/
│   │   │   ├── PeerCard.tsx           # Individual peer status card
│   │   │   ├── JobRow.tsx             # Single job in queue
│   │   │   ├── ResourceBar.tsx        # VRAM/RAM/CPU utilization bar
│   │   │   ├── StatusIndicator.tsx    # Online/offline/busy dot
│   │   │   └── InviteModal.tsx        # Create/join group flow
│   │   ├── hooks/
│   │   │   ├── useIPC.ts             # Typed IPC communication hook
│   │   │   ├── usePeers.ts           # Peer state subscription
│   │   │   └── useJobs.ts            # Job state subscription
│   │   ├── store/
│   │   │   └── index.ts              # Zustand store definitions
│   │   └── styles/
│   │       └── globals.css            # Tailwind imports, custom styles
│   │
│   ├── shared/                        # Shared types and constants
│   │   ├── types.ts                   # TypeScript interfaces (Job, Peer, Resource, etc.)
│   │   ├── constants.ts              # Polling intervals, thresholds, defaults
│   │   └── ipc-channels.ts           # Typed IPC channel definitions
│   │
│   └── proto/                         # Protocol buffer definitions
│       └── coop.proto                 # gRPC service definition (see above)
│
├── coordination-server/               # Cloudflare Worker for invite exchange
│   ├── wrangler.toml
│   └── src/
│       └── index.ts                   # KV-backed invite code exchange
│
├── scripts/
│   ├── build.sh                       # Build script
│   └── dev.sh                         # Development script
│
└── resources/                         # App icons, tray icons per platform
    ├── icon.png
    ├── tray-green.png
    ├── tray-yellow.png
    ├── tray-red.png
    └── tray-gray.png
```

---

## Database Schema (SQLite)

```sql
-- Peer information
CREATE TABLE peers (
  peer_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  wireguard_public_key TEXT NOT NULL,
  endpoint TEXT,                        -- IP:port for direct connection
  gpu_model TEXT,
  total_vram_mb INTEGER,
  total_ram_mb INTEGER,
  total_cpu_cores INTEGER,
  last_seen_at INTEGER,                 -- unix timestamp
  status TEXT DEFAULT 'offline',        -- online, idle, busy, offline
  created_at INTEGER NOT NULL
);

-- Group membership
CREATE TABLE groups (
  group_id TEXT PRIMARY KEY,
  group_name TEXT,
  invite_code TEXT,
  created_at INTEGER NOT NULL,
  is_host INTEGER DEFAULT 0
);

-- Job history
CREATE TABLE jobs (
  job_id TEXT PRIMARY KEY,
  submitter_peer_id TEXT NOT NULL,
  executor_peer_id TEXT,
  job_type TEXT NOT NULL,               -- llm_batch, llm_single, custom
  model_name TEXT,
  input_summary TEXT,                   -- brief description of input
  input_count INTEGER,                  -- number of prompts/items
  status TEXT NOT NULL,                 -- queued, running, completed, failed, preempted, cancelled
  priority TEXT DEFAULT 'normal',
  submitted_at INTEGER NOT NULL,
  started_at INTEGER,
  completed_at INTEGER,
  gpu_seconds_used INTEGER DEFAULT 0,
  error_message TEXT,
  FOREIGN KEY (submitter_peer_id) REFERENCES peers(peer_id)
);

-- Usage ledger
CREATE TABLE usage_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  peer_id TEXT NOT NULL,
  direction TEXT NOT NULL,              -- 'contributed' or 'consumed'
  gpu_seconds INTEGER NOT NULL,
  cpu_seconds INTEGER DEFAULT 0,
  bytes_transferred INTEGER DEFAULT 0,
  job_id TEXT,
  recorded_at INTEGER NOT NULL,
  FOREIGN KEY (peer_id) REFERENCES peers(peer_id),
  FOREIGN KEY (job_id) REFERENCES jobs(job_id)
);

-- Job results (batch inference outputs)
CREATE TABLE job_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL,
  input_index INTEGER NOT NULL,         -- which prompt in the batch
  input_text TEXT,
  output_text TEXT,
  tokens_generated INTEGER,
  inference_time_ms INTEGER,
  FOREIGN KEY (job_id) REFERENCES jobs(job_id)
);

-- Local config
CREATE TABLE config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

---

## IPC Channel Definitions

Communication between renderer and main/daemon processes uses typed IPC channels:

```typescript
// Channels from renderer → main
type IPCChannels = {
  // Group management
  'group:create': () => { groupId: string; inviteCode: string };
  'group:join': (inviteCode: string) => { success: boolean; error?: string };
  'group:leave': () => void;
  'group:get-invite-code': () => string;

  // Peer info
  'peers:list': () => Peer[];
  'peers:status': () => PeerStatus[];

  // Jobs
  'jobs:submit': (job: JobSubmission) => { jobId: string };
  'jobs:cancel': (jobId: string) => void;
  'jobs:list': (filter?: JobFilter) => Job[];
  'jobs:results': (jobId: string) => JobResult[];

  // Resources
  'resources:local': () => ResourceStatus;
  'resources:pool': () => ResourceStatus[];

  // Usage
  'usage:summary': () => UsageSummary[];
  'usage:history': (days: number) => UsageEntry[];

  // Settings
  'settings:get': () => AppSettings;
  'settings:update': (settings: Partial<AppSettings>) => void;

  // Ollama
  'ollama:models': () => OllamaModel[];
  'ollama:pool-models': () => { peerId: string; models: OllamaModel[] }[];
  'ollama:pull': (modelName: string) => void;

  // System
  'app:set-dnd': (enabled: boolean) => void;
  'app:get-status': () => AppStatus;
};

// Events pushed from daemon → renderer (via main process relay)
type IPCEvents = {
  'peer:connected': (peer: Peer) => void;
  'peer:disconnected': (peerId: string) => void;
  'peer:status-changed': (peerId: string, status: PeerStatus) => void;
  'job:status-changed': (jobId: string, status: JobStatus) => void;
  'job:progress': (jobId: string, progress: number) => void;
  'job:completed': (jobId: string, results: JobResult[]) => void;
  'job:preempted': (jobId: string, reason: string) => void;
  'resource:updated': (peerId: string, resources: ResourceStatus) => void;
};
```

---

## Build & Development

### Prerequisites
- Node.js >= 20
- npm >= 10
- Ollama installed and running locally
- For NVIDIA GPU monitoring: nvidia-smi in PATH
- For Tailscale MVP: Tailscale installed and logged in

### Development
```bash
npm install
npm run dev          # Starts Electron in dev mode with hot reload
```

### Build
```bash
npm run build:mac    # .dmg for macOS
npm run build:win    # .exe installer for Windows
npm run build:linux  # .AppImage and .deb for Linux
```

Use `electron-builder` for packaging. Configure in `electron-builder.yml`:

```yaml
appId: com.gpucoop.app
productName: GPU Co-op
directories:
  output: dist
mac:
  category: public.app-categories.utilities
  target: [dmg, zip]
  hardenedRuntime: true
win:
  target: [nsis]
linux:
  target: [AppImage, deb]
  category: Utility
```

### Key Dependencies

```json
{
  "dependencies": {
    "electron-updater": "latest",
    "@grpc/grpc-js": "latest",
    "@grpc/proto-loader": "latest",
    "better-sqlite3": "latest",
    "zustand": "latest",
    "react": "^18",
    "react-dom": "^18",
    "react-router-dom": "^6",
    "recharts": "latest",
    "lucide-react": "latest"
  },
  "devDependencies": {
    "electron": "latest",
    "electron-builder": "latest",
    "typescript": "^5",
    "tailwindcss": "^3",
    "@types/better-sqlite3": "latest",
    "vite": "latest",
    "@vitejs/plugin-react": "latest"
  }
}
```

---

## Implementation Order

Build in this order. Each phase should be fully functional before moving to the next.

### Phase 1: Skeleton App
1. Initialize Electron + React + TypeScript + Vite project
2. System tray with basic menu (Show, Quit)
3. Single window with React router and empty page shells
4. IPC bridge between renderer and main process
5. Verify builds on at least one platform

### Phase 2: Local Resource Monitoring
1. Implement GPU detection (nvidia-smi parsing, or fallback to CPU-only mode)
2. Implement CPU/RAM monitoring via Node.js os module
3. Build the daemon as a forked child process
4. Display local resources in the Pool Overview page
5. System tray icon changes color based on utilization

### Phase 3: Ollama Integration
1. Detect local Ollama installation and connection
2. List available models via Ollama API
3. Submit a single inference job locally and display results
4. Submit a batch job (multiple prompts) and show progress
5. Store job history and results in SQLite

### Phase 4: Networking & Peer Discovery
1. Implement the coordination server (Cloudflare Worker with KV store)
2. Implement invite code generation and exchange
3. For MVP: use Tailscale for networking, discover peers via Tailscale API
4. Establish gRPC connection between two peers
5. Implement ResourceStream — bidirectional resource status sharing
6. Display remote peer info in Pool Overview

### Phase 5: Remote Job Dispatch
1. Implement job submission to a remote peer
2. Implement data transfer (sending prompts to remote, receiving results)
3. Implement batch splitting across multiple peers
4. Progress tracking and result aggregation
5. Usage ledger recording

### Phase 6: Preemption & Resilience
1. Idle detection heuristic (GPU utilization, fullscreen app detection)
2. Preemption: pause/kill remote jobs when owner needs their GPU
3. Job restart/relocation when resources free up
4. Peer disconnect handling (mark offline, reassign jobs)
5. Graceful daemon shutdown (finish current chunk, save state)

### Phase 7: Polish
1. Usage ledger visualization (charts, per-peer breakdown)
2. Notifications (system notifications for job complete, peer events)
3. Settings page (resource limits, quiet hours, Ollama config)
4. Auto-updates via electron-updater
5. Error handling and user-friendly error messages throughout
6. Platform-specific testing and bug fixes

---

## Design Principles

1. **Owner-first**: The machine owner's local usage ALWAYS takes priority. Remote work is best-effort.
2. **Zero-config networking**: The invite code flow should be the ONLY setup step. No port forwarding, no IP addresses, no firewall rules.
3. **Fail gracefully**: If a peer disconnects mid-job, the job should be retryable, not lost. If Ollama isn't running, show a helpful message, don't crash.
4. **No vendor lock-in on inference**: Ollama today, but the abstraction layer should allow swapping in llama.cpp, vLLM, or others later.
5. **Privacy by default**: No data goes through central servers. The coordination server only sees public keys and ephemeral invite codes. All job data travels peer-to-peer over encrypted WireGuard tunnels.
6. **Transparency**: Users should always be able to see what their machine is doing, who's using it, and how much they've contributed vs consumed.

---

## Non-Goals (for now)

- **Model splitting across machines** (tensor/pipeline parallelism) — too complex, latency-sensitive. Each job runs on ONE machine that has enough resources.
- **Real money / billing** — the usage ledger is informational only.
- **Public pool / strangers** — this is for friends who trust each other. No reputation system, no sandboxing of untrusted code.
- **Arbitrary Docker workloads** — future possibility, but MVP is Ollama-only.
- **Mobile support** — desktop only.
- **Embedded WireGuard** — use Tailscale for MVP, consider embedding boringtun later.

---

## Security Considerations

- All peer communication is encrypted via WireGuard
- Invite codes are single-use and expire after 24 hours
- The coordination server stores only public keys and endpoint hints, never private keys or job data
- Ollama API is bound to localhost only — remote peers dispatch jobs via gRPC to the daemon, which talks to Ollama locally
- No remote code execution — the daemon only triggers Ollama API calls, never runs arbitrary commands from peers
- Group membership is explicit — peers must be invited, there's no open discovery

---

## Naming

- **App name**: GPU Co-op
- **Internal package name**: gpu-coop
- **Tagline**: "Share GPUs with friends"