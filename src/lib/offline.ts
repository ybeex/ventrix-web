// Offline queue. Actions taken while the device is offline are stored with a stable clientGeneratedId and
// replayed through POST /sync/batch (deviceId + clientGeneratedId is the server's idempotency key, so resending a batch is always safe).
import { useSyncExternalStore } from 'react';
import { ApiError, newKey, request } from './api';
import { deviceId } from './auth';

export interface Queued { clientGeneratedId: string; type: string; queuedAt: string; payload: Record<string, unknown>; label: string }
export interface SyncOutcome { applied: number; pending: number; problems: number; kept: number }
const KEY = 'sk.queue';
let mem: Queued[] = [];
const subs = new Set<() => void>();
let snapshot: Queued[] = read();

function read(): Queued[] { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return mem; } }
function write(q: Queued[]) { mem = q; snapshot = q; try { localStorage.setItem(KEY, JSON.stringify(q)); } catch { /* memory only */ } subs.forEach((f) => f()); }

export const enqueue = (type: string, payload: Record<string, unknown>, label: string) =>
  write([...snapshot, { clientGeneratedId: newKey(), type, queuedAt: new Date().toISOString(), payload, label }]);
export const useQueue = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => snapshot);

let flushing = false;
export async function flush(): Promise<SyncOutcome | null> {
  if (flushing || !snapshot.length || !navigator.onLine) return null;
  flushing = true;
  const sent = snapshot;
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
    write(snapshot.filter((q) => !done.has(q.clientGeneratedId)));
    return out;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) throw e;
    return null; // still unreachable: keep everything, try again later
  } finally { flushing = false; }
}
