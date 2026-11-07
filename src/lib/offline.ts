// Offline queue. Actions taken while the device is offline are stored with a stable clientGeneratedId and
// replayed through POST /sync/batch (deviceId + clientGeneratedId is the server's idempotency key, so resending a batch is always safe).
import { useSyncExternalStore } from 'react';
import { ApiError, newKey, request } from './api';
import { deviceId } from './auth';

export interface Queued { owner?: string; clientGeneratedId: string; type: string; queuedAt: string; payload: Record<string, unknown>; label: string }
export interface SyncOutcome { applied: number; pending: number; problems: number; kept: number }
const KEY = 'sk.queue';
let mem: Queued[] = [];
const subs = new Set<() => void>();
// Every queued action is stamped with the user who took it. The queue outlives a sign-out (so an expired session never loses offline work),
// which means on a shared tablet it must never be replayed — or shown — under a different user's token, or the audit trail would blame the wrong person.
let owner: string | null = null;
const STALE_MS = 7 * 24 * 3600_000; // other people's leftovers are dropped after a week
let all: Queued[] = prune(read());
let snapshot: Queued[] = [];
const mine = () => all.filter((q) => q.owner === owner);

function prune(q: Queued[]): Queued[] { const cut = Date.now() - STALE_MS; return q.filter((x) => x.owner && Date.parse(x.queuedAt) > cut); } // legacy un-owned entries cannot be attributed safely
function read(): Queued[] { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return mem; } }
function commit() { mem = all; snapshot = mine(); try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* memory only */ } subs.forEach((f) => f()); }
/** Called by the auth layer whenever the signed-in user changes (null when signed out). */
export function setQueueOwner(id: string | null) { owner = id; all = prune(all); snapshot = mine(); subs.forEach((f) => f()); }

export const enqueue = (type: string, payload: Record<string, unknown>, label: string) => {
  if (!owner) return; // nobody is signed in: refuse rather than queue an unattributable action
  all = [...all, { owner, clientGeneratedId: newKey(), type, queuedAt: new Date().toISOString(), payload, label }]; commit();
};
export const useQueue = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => snapshot);

let flushing = false;
export async function flush(): Promise<SyncOutcome | null> {
  if (flushing || !snapshot.length || !navigator.onLine) return null;
  flushing = true;
  const sent = snapshot;
  const sentOwner = owner;
  try {
    const { data } = await request<{ results: { clientGeneratedId: string; status: string }[] }>('POST', '/sync/batch', {
      body: { deviceId: deviceId().padEnd(4, '0'), actions: sent.map(({ clientGeneratedId, type, queuedAt, payload }) => ({ clientGeneratedId, type, queuedAt, payload })) },
    });
    const out: SyncOutcome = { applied: 0, pending: 0, problems: 0, kept: 0 };
    const done = new Set<string>();
    for (const r of data.results) {
      // applied/duplicate/pending_approval/conflict/rejected all leave the queue: conflicts now live under Sync problems.
      done.add(r.clientGeneratedId);
      if (r.status === 'applied' || r.status === 'duplicate') out.applied++;
      else if (r.status === 'pending_approval') out.pending++;
      else out.problems++;
    }
    all = all.filter((q) => !(q.owner === sentOwner && done.has(q.clientGeneratedId))); commit();
    return out;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) throw e;
    return null; // still unreachable: keep everything, try again later
  } finally { flushing = false; }
}
