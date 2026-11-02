import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Plus } from 'react-feather';
import { ApiError, get, newKey, post } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import type { Page } from '../lib/types';
import { Badge, Btn, Empty, Field, Modal, Skeleton } from '../components/ui';

interface Job { id: string; code?: string | null; name: string; status: 'active' | 'closed'; archivedAt?: string | null }

export default function Jobs() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const { toast, fail } = useToast();
  const [adding, setAdding] = useState(false);
  const qr = useInfiniteQuery({
    queryKey: ['jobs', 'page'], queryFn: ({ pageParam }) => get<Page<Job>>('/jobs', { limit: 50, cursor: pageParam }),
    initialPageParam: undefined as string | undefined, getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  const rows = qr.data?.pages.flatMap((p) => p.items) ?? [];
  const archive = async (j: Job) => { try { await post(`/jobs/${j.id}/archive`); toast(`${j.name} archived`); await qc.invalidateQueries({ queryKey: ['jobs'] }); } catch (e) { fail(e); } };
  return (
    <>
      <section className="page-head page-head-actions"><div><h1 className="page">Jobs</h1><p className="hero-lede">Projects and sites that items are checked out against.</p></div>{can('supervisor') && <Btn className="primary" onClick={() => setAdding(true)}><Plus className="feather-ic" />New job</Btn>}</section>
      <div className="card glass people-table" style={{ padding: 10 }}>
        {qr.isLoading ? <Skeleton rows={4} /> : !rows.length ? <Empty title="No jobs yet" /> : rows.map((j) => (
          <div className="row" key={j.id}><div className="grow"><b>{j.name}</b>{j.code && <span className="mono"> {j.code}</span>}</div><Badge cls={j.status === 'active' ? 'ok' : 'neu'}>{j.status}</Badge>{can('supervisor') && <Btn className="sm" onClick={() => archive(j)}>Archive</Btn>}</div>))}
        {qr.hasNextPage && <div style={{ padding: 12, textAlign: 'center' }}><Btn busy={qr.isFetchingNextPage} onClick={() => qr.fetchNextPage()}>Load more</Btn></div>}
      </div>
      {adding && <AddJob onClose={() => setAdding(false)} />}
    </>
  );
}

function AddJob({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { toast, fail } = useToast();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});
  const key = useRef(newKey());
  const save = async () => {
    setBusy(true); setErr({});
    try { await post('/jobs', { name: name.trim(), ...(code.trim() ? { code: code.trim() } : {}) }, key.current); toast(`${name.trim()} created`); await qc.invalidateQueries({ queryKey: ['jobs'] }); onClose(); }
    catch (e) { if (e instanceof ApiError && e.code === 'VALIDATION_ERROR') setErr(e.fieldErrors()); fail(e); } finally { setBusy(false); }
  };
  return (
    <Modal title="New job" onClose={onClose}>
      <Field label="Name" error={err.name}><input value={name} onChange={(e) => { setName(e.target.value); key.current = newKey(); }} /></Field>
      <Field label="Code (optional)" error={err.code}><input value={code} onChange={(e) => { setCode(e.target.value); key.current = newKey(); }} /></Field>
      <div className="row-flex" style={{ justifyContent: 'flex-end' }}><Btn onClick={onClose}>Cancel</Btn><Btn className="primary" busy={busy} disabled={!name.trim()} onClick={save}>Create</Btn></div>
    </Modal>
  );
}
