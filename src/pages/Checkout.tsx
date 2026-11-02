import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Trash2, Calendar, ChevronLeft, ChevronRight } from 'react-feather';
import { ApiError, newKey, post } from '../lib/api';
import { enqueue } from '../lib/offline';
import { useToast } from '../lib/toast';
import type { Item, TxnResult } from '../lib/types';
import { Btn, Stepper } from '../components/ui';
import { HolderSelect, ItemSearch } from '../components/pickers';
import { useSnapshot } from '../components/Snapshot';
import { useQuery } from '@tanstack/react-query';
import { get } from '../lib/api';

interface Line { item: Item; qty: number }

export default function Checkout() {
  const [holder, setHolder] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [purpose, setPurpose] = useState('');
  const [jobId, setJobId] = useState('');
  const [dueLocal, setDueLocal] = useState('');
  const dueDate = dueLocal ? new Date(dueLocal) : null;
  const dueAt = dueDate && Number.isFinite(dueDate.getTime()) ? dueDate.toISOString() : undefined;
  const snap = useSnapshot('checkout');
  const jobs = useQuery({ queryKey: ['jobs', 'active'], queryFn: () => get<{ items: { id: string; name: string }[] }>('/jobs', { status: 'active', limit: 100 }), networkMode: 'always', retry: 0 });
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const key = useRef(newKey());
  const qc = useQueryClient();
  const nav = useNavigate();
  const { toast, fail } = useToast();
  // A changed cart is a new intent, so it gets a new key. An unchanged retry keeps the same one.
  const edit = (fn: (l: Line[]) => Line[]) => { key.current = newKey(); setLines(fn); };

  const add = (item: Item) => {
    if (item.archivedAt) return toast(`${item.name} is archived.`);
    if (item.type === 'asset' && item.assetState !== 'available') return fail(new ApiError(0, 'X', `${item.name} is not available (${item.assetState?.replace('_', ' ')}).`));
    if (lines.some((l) => l.item.id === item.id)) return toast(`${item.name} is already on the list.`);
    edit((l) => [...l, { item, qty: 1 }]);
  };
  const submit = async () => {
    if (!navigator.onLine && snap.required) { fail(new ApiError(0, 'X', 'A photo is required for check-out, so it cannot be saved offline.')); return; }
    if (!navigator.onLine) {
      // Offline: each line is saved as its own action. Unlike the online batch, lines are applied (or refused) one by one on reconnect.
      lines.forEach((l) => enqueue('checkout', { itemId: l.item.id, holderId: holder, ...(l.item.type === 'consumable' ? { quantity: l.qty } : {}), ...(purpose ? { purpose } : {}), ...(jobId ? { jobId } : {}), ...(dueAt ? { dueAt } : {}) }, `Check out: ${l.item.name}`));
      toast(`Saved on this device. ${lines.length} ${lines.length === 1 ? 'item' : 'items'} will be checked out when you are back online.`);
      setLines([]); key.current = newKey(); nav('/outstanding');
      return;
    }
    setBusy(true);
    try {
      const snapshotFileId = await snap.send();
      const { data, status } = await post<TxnResult>('/transactions/checkout/batch', {
        holderId: holder, lines: lines.map((l) => ({ itemId: l.item.id, ...(l.item.type === 'consumable' ? { quantity: l.qty } : {}) })), ...(purpose ? { purpose } : {}), ...(jobId ? { jobId } : {}), ...(dueAt ? { dueAt } : {}), ...(snapshotFileId ? { snapshotFileId } : {}),
      }, key.current);
      if (data.status === 'pending_approval') { setPending(true); toast('Sent for approval. Nothing has moved yet.'); }
      else { toast(`Checked out ${lines.length} ${lines.length === 1 ? 'item' : 'items'}${status === 200 ? ' (already saved)' : ''}`); }
      await qc.invalidateQueries();
      key.current = newKey();
      if (data.status === 'committed') nav('/outstanding');
    } catch (e) { fail(e); } finally { setBusy(false); }
  };
  const ready = holder && lines.length > 0;
  return (
    <>
      <section className="page-head"><h1 className="page">Check out</h1><p className="hero-lede">Pick who is taking the items, add them, confirm. All of it saves together or not at all.</p></section>
      {pending && <div className="alert info glass" role="status"><div><strong>Awaiting approval</strong><span>Your request was filed. Nothing has left the store yet.</span></div><Btn onClick={() => { setPending(false); setLines([]); }}>Start another</Btn></div>}
      <form className="checkout-form glass" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <div className="checkout-details"><h3>Who</h3>
          <div className="checkout-who-grid">
          <HolderSelect value={holder} onChange={setHolder} />
          {!!jobs.data?.items.length && <label className="field">Job (optional)<span className="input"><select value={jobId} onChange={(e) => { key.current = newKey(); setJobId(e.target.value); }}><option value="">No job</option>{jobs.data.items.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}</select></span></label>}
          <label className="field">Purpose (optional)<span className="input"><input value={purpose} onChange={(e) => { key.current = newKey(); setPurpose(e.target.value); }} /></span></label>
          <DueDatePicker value={dueLocal} onChange={(v) => { key.current = newKey(); setDueLocal(v); }} />
                    </div>
<h3 style={{ marginTop: 8 }}>Add items</h3>
          <ItemSearch onPick={add} autoFocus />
        </div>
        <div className="checkout-cart"><h3>This checkout</h3>
          {!lines.length ? <p className="muted">Scan or search to add items.</p> : lines.map((l) => (
            <div className="row" key={l.item.id}>
              <div className="grow"><b>{l.item.name}</b><div className="mono">{l.item.itemNumber}{l.item.type === 'consumable' ? ` · ${l.item.quantityAvailable} ${l.item.unit} in stock` : ' · asset'}</div></div>
              {l.item.type === 'consumable' && <Stepper value={l.qty} max={l.item.quantityAvailable ?? undefined} onChange={(n) => edit((ls) => ls.map((x) => x.item.id === l.item.id ? { ...x, qty: n } : x))} />}
              <button type="button" className="btn icon sm" aria-label={`Remove ${l.item.name}`} onClick={() => edit((ls) => ls.filter((x) => x.item.id !== l.item.id))}><Trash2 className="feather-ic" /></button>
            </div>))}
        </div>
        <div className="checkout-submit">{snap.field}<Btn className="primary" type="submit" busy={busy} disabled={!ready}><ArrowUpRight className="feather-ic" />Check out {lines.length || ''} {lines.length === 1 ? 'item' : 'items'}</Btn></div>
      </form>
    </>
  );
}

function DueDatePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const parse = (v: string) => { const [d, t] = v.split('T'); const [y, m, day] = (d || '').split('-').map(Number); return { date: y && m && day ? new Date(y, m - 1, day) : null, time: t || '17:00' }; };
  const initial = parse(value);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => new Date((initial.date ?? new Date()).getFullYear(), (initial.date ?? new Date()).getMonth(), 1));
  const selected = initial.date;
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (start.getDay() + 6) % 7;
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, i) => i - offset + 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  const emit = (date: Date, time: string) => onChange(`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${time || '17:00'}`);
  const today = new Date();
  return <div className="field due-picker"><span>Due date and time (optional)</span><div className="due-picker-controls"><button type="button" className="btn due-date-trigger" aria-expanded={open} onClick={() => setOpen((v) => !v)}><Calendar className="feather-ic" />{selected ? selected.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Choose date'}</button><label className="sr" htmlFor="checkout-due-time">Due time</label><input id="checkout-due-time" className="due-time-input" type="time" value={value.split('T')[1] || '17:00'} disabled={!selected} onChange={(e) => selected && emit(selected, e.target.value)} />{value && <button type="button" className="btn sm" onClick={() => onChange('')}>Clear</button>}</div>{open && <div className="due-calendar" role="dialog" aria-label="Choose due date"><div className="due-calendar-head"><button type="button" className="btn icon sm" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft className="feather-ic" /></button><b>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</b><button type="button" className="btn icon sm" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight className="feather-ic" /></button></div><div className="due-calendar-grid">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d) => <span className="due-weekday" key={d}>{d}</span>)}{cells.map((day, i) => { const valid = day > 0 && day <= count; const date = valid ? new Date(month.getFullYear(), month.getMonth(), day) : null; const active = !!date && !!selected && date.toDateString() === selected.toDateString(); const isToday = !!date && date.toDateString() === today.toDateString(); return <button key={i} type="button" disabled={!valid} className={'due-day' + (active ? ' selected' : '') + (isToday ? ' today' : '')} onClick={() => { if (date) { emit(date, value.split('T')[1] || '17:00'); setOpen(false); } }}>{valid ? day : ''}</button>; })}</div></div>}</div>;
}
