import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { flush, useQueue } from '../lib/offline';
import { refreshSnapshot } from '../lib/snapshot';
import { useToast } from '../lib/toast';

// Shows what is waiting and replays the queue when the connection returns.
export function SyncBar() {
  const q = useQueue();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const o = await flush();
      if (o) {
        const bits = [o.applied && `${o.applied} saved`, o.pending && `${o.pending} awaiting approval`, o.problems && `${o.problems} need review under Sync problems`].filter(Boolean);
        toast(`Synced: ${bits.join(', ') || 'nothing to send'}`); await qc.invalidateQueries();
      }
    } catch { /* 401 handled globally */ } finally { setBusy(false); }
  };
  // Keep the offline copy of items and holders fresh while online.
  useEffect(() => { void refreshSnapshot(); const f = () => void refreshSnapshot(); addEventListener('online', f); const t = setInterval(f, 10 * 60_000); return () => { removeEventListener('online', f); clearInterval(t); }; }, []);
  useEffect(() => { const f = () => void run(); addEventListener('online', f); const t = setInterval(f, 30_000); if (q.length) f(); return () => { removeEventListener('online', f); clearInterval(t); }; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!q.length) return null;
  return (
    <div className="wrap syncbar-wrap"><div className="alert warn glass" role="status">
      <div className="grow"><strong>{q.length} {q.length === 1 ? 'action' : 'actions'} waiting to sync</strong><span>{q.slice(0, 3).map((x) => x.label).join(' · ')}{q.length > 3 ? ' …' : ''}</span></div>
      <button className="btn sm" disabled={busy || !navigator.onLine} onClick={run}>{busy ? 'Syncing…' : 'Sync now'}</button>
    </div></div>
  );
}
