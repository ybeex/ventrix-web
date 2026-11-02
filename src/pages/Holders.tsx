import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Plus } from 'react-feather';
import { ApiError, get, newKey, post } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import type { Holder, Page } from '../lib/types';
import { Badge, Btn, Empty, Field, Modal, Skeleton } from '../components/ui';
import { useDebounced } from '../components/pickers';

const KINDS: [Holder['kind'], string][] = [['person', 'Person'], ['team', 'Team'], ['department', 'Department'], ['job_site', 'Job site'], ['other', 'Other']];

export default function Holders() {
  const { can } = useAuth();
  const [q, setQ] = useState('');
  const dq = useDebounced(q.trim());
  const [adding, setAdding] = useState(false);
  const qr = useInfiniteQuery({
    queryKey: ['holders', 'page', dq],
    queryFn: ({ pageParam }) => get<Page<Holder>>('/holders', { limit: 50, cursor: pageParam, q: dq || undefined }),
    initialPageParam: undefined as string | undefined, getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  const rows = qr.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <>
      <section className="page-head"><h1 className="page">People & teams</h1><p className="hero-lede">Everyone and everything that can hold store items. People do not need a login.</p></section>
      <div className="row-flex" style={{ marginBottom: 16 }}>
        <span className="input grow" style={{ maxWidth: 360 }}><input aria-label="Search holders" placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} /></span>
        {can('store_staff') && <Btn className="primary" onClick={() => setAdding(true)}><Plus className="feather-ic" />Add</Btn>}
      </div>
      <div className="card glass people-table" style={{ padding: 10 }}>
        {qr.isLoading ? <Skeleton rows={5} /> : !rows.length ? <Empty title="No one found" /> : rows.map((h) => (
          <div className="row" key={h.id}><div className="grow"><b>{h.name}</b>{h.code && <span className="mono"> {h.code}</span>}</div><Badge cls="neu">{h.kind.replace('_', ' ')}</Badge></div>))}
        {qr.hasNextPage && <div style={{ padding: 12, textAlign: 'center' }}><Btn busy={qr.isFetchingNextPage} onClick={() => qr.fetchNextPage()}>Load more</Btn></div>}
      </div>
      {adding && <AddHolder onClose={() => setAdding(false)} />}
    </>
  );
}

function AddHolder({ onClose }: { onClose: () => void }) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const { toast, fail } = useToast();
  const [kind, setKind] = useState<Holder['kind']>('person');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});
  const key = useRef(newKey());
  const kinds = can('admin') ? KINDS : KINDS.filter(([k]) => k === 'person'); // the server allows only admins to add other kinds
  const save = async () => {
    if (!name.trim()) return setErr({ name: 'Enter a name.' });
    setBusy(true); setErr({});
    try { await post('/holders', { kind, name: name.trim() }, key.current); toast(`${name.trim()} added`); await qc.invalidateQueries({ queryKey: ['holders'] }); onClose(); }
    catch (e) { if (e instanceof ApiError && e.code === 'VALIDATION_ERROR') setErr(e.fieldErrors()); fail(e); } finally { setBusy(false); }
  };
  return (
    <Modal title="Add a person or team" onClose={onClose}>
      {kinds.length > 1 && <Field label="Kind"><select value={kind} onChange={(e) => setKind(e.target.value as Holder['kind'])}>{kinds.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>}
      <Field label="Name" error={err.name}><input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} /></Field>
      <div className="row-flex" style={{ justifyContent: 'flex-end' }}><Btn onClick={onClose}>Cancel</Btn><Btn className="primary" busy={busy} onClick={save}>Add</Btn></div>
    </Modal>
  );
}
