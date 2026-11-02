import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ClipboardIcon } from '../components/icons';
import { get, newKey, post } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import type { Page, Recon, Shelf } from '../lib/types';
import { fmtDate } from '../lib/format';
import { Badge, Btn, Empty, Skeleton } from '../components/ui';

export default function Counts() {
  const { can, me } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { fail } = useToast();
  const shelves = useQuery({ queryKey: ['shelves'], queryFn: () => get<{ items: Shelf[] }>('/shelves') });
  const open = useQuery({ queryKey: ['recon', 'open'], queryFn: () => get<Page<Recon>>('/reconciliations', { status: 'open', limit: 50 }) });
  const [busy, setBusy] = useState('');
  const keys = useRef<Record<string, string>>({});
  const start = async (s: Shelf) => {
    setBusy(s.id); keys.current[s.id] ??= newKey(); // same key on retry: never opens two counts for one tap
    try {
      const { data } = await post<Recon>('/reconciliations', { scope: 'shelf', scopeId: s.id }, keys.current[s.id]);
      delete keys.current[s.id]; await qc.invalidateQueries({ queryKey: ['recon'] }); nav(`/counts/${data.id}`);
    } catch (e) { fail(e); } finally { setBusy(''); }
  };
  const nameOf = (id: string) => shelves.data?.items.find((s) => s.id === id)?.name ?? 'Shelf';
  const due = (s: Shelf) => !!s.nextCountDueAt && new Date(s.nextCountDueAt) <= new Date();
  return (
    <>
      <section className="page-head"><h1 className="page">Stock counts</h1><p className="hero-lede">Count a shelf against the system. Any difference needs a reason, and the original count stays on record.</p></section>
      {!!open.data?.items.length && <div className="card glass" style={{ marginBottom: 20 }}><h3>In progress</h3>
        {open.data.items.map((r) => <Link key={r.id} to={`/counts/${r.id}`} className="row click"><div className="grow"><b>{r.scope === 'shelf' ? nameOf(r.scopeId) : r.scope}</b><div className="mono">Started {fmtDate(r.startedAt, me?.organization.timezone)}</div></div><Badge cls="warn">Open</Badge></Link>)}</div>}
      <div className="card glass table-list" style={{ padding: 10 }}>
        {shelves.isLoading ? <Skeleton rows={3} /> : !shelves.data?.items.length ? <Empty title="No shelves" /> : shelves.data.items.map((s) => (
          <div className="row" key={s.id}><div className="grow"><b>{s.name}</b> <span className="mono">{s.code}</span><div className="mono">{s.itemCount} items · last counted {s.lastCountedAt ? fmtDate(s.lastCountedAt, me?.organization.timezone) : 'never'} · every {s.cycleCountDays} days</div></div>
            {due(s) ? <Badge cls="warn">Count due</Badge> : <Badge cls="ok">Up to date</Badge>}
            {can('supervisor') && <Btn className="sm primary" busy={busy === s.id} onClick={() => start(s)}><ClipboardIcon />Count</Btn>}</div>))}
      </div>
    </>
  );
}
