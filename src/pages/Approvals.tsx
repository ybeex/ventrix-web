import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Check, X } from 'react-feather';
import { ApiError, get, post } from '../lib/api';
import { useToast } from '../lib/toast';
import type { Approval, Page } from '../lib/types';
import { fmtDateTime } from '../lib/format';
import { Badge, Btn, Empty, Field, Modal, Skeleton } from '../components/ui';

export default function Approvals() {
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const q = useQuery({ queryKey: ['approvals', status], queryFn: () => get<Page<Approval>>('/approvals', { status, limit: 50 }) });
  const qc = useQueryClient();
  const { toast, fail } = useToast();
  const [rej, setRej] = useState<Approval | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const decide = async (a: Approval, how: 'approve' | 'reject', n?: string) => {
    setBusy(a.id);
    try { await post(`/approvals/${a.id}/${how}`, n ? { note: n } : {}); toast(how === 'approve' ? 'Approved and recorded' : 'Rejected'); setRej(null); setNote(''); await qc.invalidateQueries(); }
    catch (e) { fail(e instanceof ApiError && e.status === 409 ? new ApiError(409, e.code, `${e.message} The item may have changed since the request.`) : e); await qc.invalidateQueries(); }
    finally { setBusy(''); }
  };
  return (
    <>
      <section className="page-head"><h1 className="page">Approvals</h1><p className="hero-lede">Requests staff filed that need a supervisor. Approving re-checks the live stock first.</p></section>
      <div className="seg glass" style={{ marginBottom: 16 }}>{(['pending', 'approved', 'rejected'] as const).map((s) => <button key={s} aria-pressed={status === s} onClick={() => setStatus(s)}>{s[0].toUpperCase() + s.slice(1)}</button>)}</div>
      <div className="card glass" style={{ padding: 10 }}>
        {q.isLoading ? <Skeleton /> : !q.data?.items.length ? <Empty title={status === 'pending' ? 'Nothing waiting' : 'Nothing here'} /> : q.data.items.map((a) => (
          <div className="row" key={a.id}>
            <div className="grow"><b>{a.operation.replace('_', ' ')}: {a.item.name}</b> <span className="mono">{a.item.itemNumber}</span><div className="mono">Requested by {a.requestedBy.name ?? 'someone'} · {fmtDateTime(a.createdAt)}{a.reviewNote ? ` · “${a.reviewNote}”` : ''}</div></div>
            {a.status === 'pending' ? <>
              <Btn className="sm primary" busy={busy === a.id} onClick={() => decide(a, 'approve')}><Check className="feather-ic" />Approve</Btn>
              <Btn className="sm danger" disabled={busy === a.id} onClick={() => setRej(a)}><X className="feather-ic" />Reject</Btn></> : <Badge cls={a.status === 'approved' ? 'ok' : 'neu'}>{a.status}</Badge>}
          </div>))}
      </div>
      {rej && <Modal title={`Reject ${rej.item.name}?`} onClose={() => setRej(null)}>
        <Field label="Reason (shown to the requester)"><input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <div className="row-flex" style={{ justifyContent: 'flex-end' }}><Btn onClick={() => setRej(null)}>Cancel</Btn><Btn className="danger" busy={busy === rej.id} onClick={() => decide(rej, 'reject', note)}>Reject</Btn></div></Modal>}
    </>
  );
}
