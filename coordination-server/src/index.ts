/**
 * GPU Co-op Coordination Server — Cloudflare Worker
 *
 * Ephemeral invite code exchange for WireGuard peer discovery.
 * NEVER in the data path after peers connect.
 *
 * Endpoints:
 *   POST /create-group   — host registers group + WireGuard public key
 *   POST /join-group     — joiner exchanges public key, gets host's key back
 *   GET  /group/:code    — check if a code is valid (polling)
 */

export interface Env {
  INVITE_CODES: KVNamespace;
}

const TTL_SECONDS = 24 * 60 * 60; // 24 hours
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

function err(msg: string, status = 400): Response {
  return json({ error: msg }, status);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          ...CORS,
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (method === 'POST' && url.pathname === '/create-group') {
      return handleCreateGroup(request, env);
    }

    if (method === 'POST' && url.pathname === '/join-group') {
      return handleJoinGroup(request, env);
    }

    const match = url.pathname.match(/^\/group\/([A-Z0-9-]{11})$/);
    if (method === 'GET' && match) {
      return handleGetGroup(match[1], env);
    }

    return err('Not found', 404);
  },
};

interface GroupRecord {
  groupId: string;
  hostPublicKey: string;
  hostEndpointHint: string;
  inviteCode: string;
  createdAt: number;
  peers: PeerRecord[];
}

interface PeerRecord {
  peerId: string;
  publicKey: string;
  endpointHint: string;
  joinedAt: number;
}

async function handleCreateGroup(request: Request, env: Env): Promise<Response> {
  let body: { groupId?: string; publicKey?: string; endpointHint?: string; displayName?: string };
  try {
    body = await request.json();
  } catch {
    return err('Invalid JSON');
  }

  const { groupId, publicKey, endpointHint } = body;
  if (!groupId || !publicKey) {
    return err('groupId and publicKey required');
  }

  const inviteCode = generateCode();
  const record: GroupRecord = {
    groupId,
    hostPublicKey: publicKey,
    hostEndpointHint: endpointHint ?? '',
    inviteCode,
    createdAt: Date.now(),
    peers: [],
  };

  await env.INVITE_CODES.put(inviteCode, JSON.stringify(record), {
    expirationTtl: TTL_SECONDS,
  });

  return json({ inviteCode });
}

async function handleJoinGroup(request: Request, env: Env): Promise<Response> {
  let body: { inviteCode?: string; publicKey?: string; endpointHint?: string; peerId?: string };
  try {
    body = await request.json();
  } catch {
    return err('Invalid JSON');
  }

  const { inviteCode, publicKey, endpointHint, peerId } = body;
  if (!inviteCode || !publicKey || !peerId) {
    return err('inviteCode, publicKey, and peerId required');
  }

  const raw = await env.INVITE_CODES.get(inviteCode);
  if (!raw) return err('Invalid or expired invite code', 404);

  const record: GroupRecord = JSON.parse(raw);

  // Add joiner to peers list
  const peer: PeerRecord = {
    peerId,
    publicKey,
    endpointHint: endpointHint ?? '',
    joinedAt: Date.now(),
  };
  record.peers.push(peer);

  await env.INVITE_CODES.put(inviteCode, JSON.stringify(record), {
    expirationTtl: TTL_SECONDS,
  });

  // Return host info + all existing peers to the joiner
  return json({
    groupId: record.groupId,
    hostPublicKey: record.hostPublicKey,
    hostEndpointHint: record.hostEndpointHint,
    peers: record.peers.filter((p) => p.peerId !== peerId),
  });
}

async function handleGetGroup(code: string, env: Env): Promise<Response> {
  const raw = await env.INVITE_CODES.get(code);
  if (!raw) return err('Not found', 404);
  const record: GroupRecord = JSON.parse(raw);
  return json({ valid: true, peerCount: record.peers.length + 1 });
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const rand = (n: number) => Math.floor(Math.random() * n);
  const seg = (len: number) =>
    Array.from({ length: len }, () => chars[rand(chars.length)]).join('');
  return `${seg(3)}-${seg(3)}-${seg(3)}`;
}
