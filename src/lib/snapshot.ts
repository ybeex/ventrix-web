// Offline reference data (FRONTEND-INTEGRATION §6): items and holders cached in IndexedDB so search, scanning and
// the holder picker keep working without a connection. Refreshed with ?since=<serverTime> deltas; rows are upserted
// by id and archived items are kept (flagged) so old labels still resolve.
import { get } from './api';
import type { Holder, Item } from './types';

const DB = 'storekeeper-cache-v1';
let dbp: Promise<IDBDatabase> | null = null;
const open = () => (dbp ??= new Promise((res, rej) => {
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => { for (const s of ['items', 'holders', 'meta']) r.result.createObjectStore(s, s === 'meta' ? undefined : { keyPath: 'id' }); };
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
}));
const tx = async <T,>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> => {
  const db = await open();
  return new Promise((res, rej) => { const t = db.transaction(store, mode); const q = fn(t.objectStore(store)); t.oncomplete = () => res(q ? q.result : undefined); t.onerror = () => rej(t.error); });
};
const all = <T,>(store: string) => tx<T[]>(store, 'readonly', (s) => s.getAll()).then((r) => r ?? []).catch(() => [] as T[]);

interface Snap<T> { items: T[]; cursor?: string | null; hasMore: boolean; serverTime: string }
async function pull<T extends { id: string }>(path: string, store: string, metaKey: string) {
  const since = (await tx<string>('meta', 'readonly', (s) => s.get(metaKey)).catch(() => undefined)) ?? undefined;
  let cursor: string | undefined; let serverTime = ''; let n = 0;
  do {
    const p = await get<Snap<T>>(path, { limit: 500, cursor, since });
    if (p.items.length) await tx(store, 'readwrite', (s) => { p.items.forEach((i) => s.put(i)); });
    cursor = p.hasMore && p.cursor ? p.cursor : undefined; serverTime = p.serverTime; n += p.items.length;
  } while (cursor && n < 20000);
  // Only advance the marker after a full pass, so an interrupted refresh is simply repeated.
  await tx('meta', 'readwrite', (s) => { s.put(serverTime, metaKey); });
}

let running = false;
export async function refreshSnapshot() {
  if (running || !navigator.onLine || typeof indexedDB === 'undefined') return;
  running = true;
  try { await pull<Item>('/sync/snapshot/items', 'items', 'itemsSince'); await pull<Holder>('/sync/snapshot/holders', 'holders', 'holdersSince'); localStorage.setItem('sk.snap', String(Date.now())); }
  catch { /* offline or session ended: keep what we have */ } finally { running = false; }
}
export async function clearSnapshot() { try { for (const s of ['items', 'holders', 'meta']) await tx(s, 'readwrite', (st) => { st.clear(); }); } catch { /* ignore */ } }

export async function searchLocal(q: string, limit = 8): Promise<Item[]> {
  const n = q.trim().toLowerCase();
  const rows = (await all<Item>('items')).filter((i) => !i.archivedAt);
  const exact = rows.filter((i) => i.code?.toLowerCase() === n || i.itemNumber.toLowerCase() === n || i.sku?.toLowerCase() === n);
  const part = rows.filter((i) => !exact.includes(i) && (`${i.name} ${i.itemNumber} ${i.sku ?? ''} ${i.code ?? ''}`).toLowerCase().includes(n));
  return [...exact, ...part].slice(0, limit);
}
export async function lookupLocal(code: string): Promise<Item | undefined> {
  const n = code.trim().toLowerCase();
  return (await all<Item>('items')).find((i) => i.code?.toLowerCase() === n || i.itemNumber.toLowerCase() === n || i.sku?.toLowerCase() === n);
}
export const holdersLocal = async () => (await all<Holder>('holders')).filter((h) => !(h as { archivedAt?: string | null }).archivedAt).sort((a, b) => a.name.localeCompare(b.name));
