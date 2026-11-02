import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError, get, post } from '../lib/api';
import { useToast } from '../lib/toast';
import type { Page } from '../lib/types';
import { fmtDateTime } from '../lib/format';
import { Badge, Btn, Empty, Skeleton } from '../components/ui';

interface Issue { id: string; kind: 'conflict' | 'rejected'; status: string; actor?: { name?: string }; operation: string; code: string; message: string; detectedAt: string; payload?: { quantity?: number } }

export default function SyncProblems() {
  const q = useQuery({ queryKey: ['sync', 'open'], queryFn: () => get<Page<Issue>>('/sync/conflicts', { status: 'open', limit: 50 }) });
  const qc = useQueryClient();
  const { toast, fail } = useToast();
  const [busy, setBusy] = useState('');
  const resolve = async (i: Issue, resolution: 'keep_server' | 'apply_client') => {
    setBusy(i.id + resolution);
    try { await post(`/sync/conflicts/${i.id}/resolve`, { resolution, note: resolution === 'keep_server' ? 'Dismissed from web' : 'Applied from web' }); toast(resolution === 'keep_server' ? 'Kept the server version' : 'Applied the saved action'); }
    catch (e) { fail(e instanceof ApiError && e.status === 409 ? new ApiError(409, e.code, `Still cannot apply it: ${e.message}`) : e); }
    finally { setBusy(''); await qc.invalidateQueries(); }
  };
  return (
    <>
      <section className="page-head"><h1 className="page">Sync problems</h1><p className="hero-lede">Actions saved offline that could not be applied because the store changed in the meantime.</p></section>
      <div className="card glass" style={{ padding: 10 }}>
        {q.isLoading ? <Skeleton /> : !q.data?.items.length ? <Empty title="No problems">Everything saved offline has been applied.</Empty> : q.data.items.map((i) => (
          <div className="row" key={i.id} style={{ flexWrap: 'wrap' }}>
            <div className="grow"><b>{i.operation}</b> by {i.actor?.name ?? 'someone'}<div>{i.message}</div><div className="mono">{i.code} · {fmtDateTime(i.detectedAt)}</div></div>
            <Badge cls={i.kind === 'rejected' ? 'neu' : 'bad'}>{i.kind === 'rejected' ? 'Invalid' : 'Conflict'}</Badge>
            {i.kind === 'conflict' && <Btn className="sm" busy={busy === i.id + 'apply_client'} onClick={() => resolve(i, 'apply_client')}>Apply anyway</Btn>}
            <Btn className="sm" busy={busy === i.id + 'keep_server'} onClick={() => resolve(i, 'keep_server')}>{i.kind === 'rejected' ? 'Dismiss' : 'Keep server'}</Btn>
          </div>))}
      </div>
    </>
  );
}
