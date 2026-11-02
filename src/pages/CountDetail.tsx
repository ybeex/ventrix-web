import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError, get, newKey, post } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import type { CountRow, ExpectedRow, Page, Recon } from '../lib/types';
import { Badge, Btn, Empty, Skeleton } from '../components/ui';
import { useSnapshot } from '../components/Snapshot';

const REASONS: [string, string][] = [['count_correction', 'Physical count correction'], ['unrecorded_movement', 'Unrecorded movement'], ['damage', 'Damaged'], ['loss', 'Lost'], ['opening_balance_correction', 'Opening balance was wrong'], ['other', 'Other']];

function Line({ reconId, row, locked, done }: { reconId: string; row: ExpectedRow; locked: boolean; done?: CountRow }) {
  const [qty, setQty] = useState(done ? String(done.physicalQuantity) : '');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const key = useRef(newKey());
  const snap = useSnapshot('reconciliation');
  const qc = useQueryClient();
  const { toast, fail } = useToast();
  const n = qty === '' ? null : Number(qty);
  const variance = n !== null && Number.isInteger(n) ? n - row.systemQuantity : null;
  const save = async () => {
    if (n === null || !Number.isInteger(n) || n < 0) return fail(new ApiError(0, 'X', 'Enter a whole number, zero or more.'));
    if (variance && !reason) return fail(new ApiError(0, 'X', `Counted ${n}, system says ${row.systemQuantity}. Choose a reason for the difference.`));
    setBusy(true);
    try {
      const snapshotFileId = await snap.send();
      const { data } = await post<{ count: CountRow }>(`/reconciliations/${reconId}/counts`, { itemId: row.itemId, physicalQuantity: n, ...(variance ? { reason } : {}), ...(snapshotFileId ? { snapshotFileId } : {}) }, key.current);
      key.current = newKey();
      const r = data.count.resolution;
      toast(r === 'matched' ? `${row.name}: matches` : r === 'pending_approval' ? `${row.name}: variance of ${data.count.variance} sent for approval` : `${row.name}: variance of ${data.count.variance} recorded`);
      await qc.invalidateQueries({ queryKey: ['recon', reconId] }); await qc.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (e) { fail(e); } finally { setBusy(false); }
  };
  return (
    <div className="row" style={{ flexWrap: 'wrap' }}>
      <div className="grow"><b>{row.name}</b> <span className="mono">{row.itemNumber}</span><div className="mono">System: {row.systemQuantity} {row.unit}</div></div>
      {row.counted && done ? <Badge cls={done.variance ? 'warn' : 'ok'}>{done.physicalQuantity} counted{done.variance ? ` (${done.variance > 0 ? '+' : ''}${done.variance})` : ''}</Badge> : locked ? <Badge cls="neu">Not counted</Badge> : <>
        <span className="input" style={{ minHeight: 44, width: 96 }}><input inputMode="numeric" aria-label={`Counted quantity for ${row.name}`} value={qty} onChange={(e) => { setQty(e.target.value.replace(/\D/g, '')); key.current = newKey(); }} placeholder="Count" /></span>
        {!!variance && <span className="input" style={{ minHeight: 44 }}><select aria-label="Reason for the difference" value={reason} onChange={(e) => { setReason(e.target.value); key.current = newKey(); }}><option value="">Reason…</option>{REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></span>}
        {variance !== null && <Badge cls={variance ? 'bad' : 'ok'}>{variance ? `${variance > 0 ? '+' : ''}${variance}` : 'Matches'}</Badge>}
        {snap.required && <span style={{ display: 'contents' }}>{snap.field}</span>}
        <Btn className="sm primary" busy={busy} disabled={n === null} onClick={save}>Save</Btn></>}
    </div>
  );
}

export default function CountDetail() {
  const { id = '' } = useParams();
  const { can } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { toast, fail } = useToast();
  const [closing, setClosing] = useState(false);
  const closeKey = useRef(newKey());
  const det = useQuery({ queryKey: ['recon', id], queryFn: () => get<{ reconciliation: Recon; counts: CountRow[]; summary?: Record<string, number> }>(`/reconciliations/${id}`) });
  const exp = useQuery({ queryKey: ['recon', id, 'expected'], queryFn: () => get<Page<ExpectedRow>>(`/reconciliations/${id}/expected`, { limit: 100 }) });
  if (det.isLoading || exp.isLoading) return <div className="sec"><Skeleton rows={5} /></div>;
  if (!det.data) return <Empty title="Count not found"><Link to="/counts">Back to counts</Link></Empty>;
  const r = det.data.reconciliation, locked = r.status === 'closed' || !can('supervisor');
  const byItem = new Map(det.data.counts.map((c) => [c.itemId, c]));
  const rows = (exp.data?.items ?? []).map((x) => ({ ...x, counted: x.counted || byItem.has(x.itemId) }));
  const left = rows.filter((x) => !x.counted).length;
  const close = async () => {
    setClosing(true);
    try { await post(`/reconciliations/${id}/close`, {}, closeKey.current); toast('Count closed'); await qc.invalidateQueries(); nav('/counts'); }
    catch (e) { fail(e); } finally { setClosing(false); }
  };
  return (
    <>
      <section className="page-head"><Link to="/counts" className="mono">← Stock counts</Link><h1 className="page" style={{ marginTop: 8 }}>{r.status === 'open' ? 'Counting' : 'Count closed'}</h1>
        <p className="hero-lede">{r.status === 'open' ? `${left} of ${rows.length} items still to count.` : 'This count is closed and cannot be changed.'}</p></section>
      <div className="card glass table-list" style={{ padding: 10 }}>
        {rows.map((x) => <Line key={x.itemId} reconId={id} row={x} locked={locked} done={byItem.get(x.itemId)} />)}
        {exp.data?.nextCursor && <p className="muted" style={{ padding: 12 }}>Showing the first 100 items.</p>}
      </div>
      {r.status === 'open' && can('supervisor') && <div style={{ marginTop: 16 }}><Btn className="primary" busy={closing} onClick={close}>{left ? `Close count (${left} not counted)` : 'Close count'}</Btn></div>}
    </>
  );
}
