import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, get, newKey, post } from '../lib/api';
import { useToast } from '../lib/toast';
import type { Item } from '../lib/types';
import { Btn, Field, Modal } from './ui';

interface Cat { id: string; name: string; shelfName: string }
const num = (v: string) => v.replace(/\D/g, '');

export function AddItemModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { toast, fail } = useToast();
  const cats = useQuery({ queryKey: ['categories'], queryFn: () => get<{ items: Cat[] }>('/categories') });
  const [f, setF] = useState({ type: 'asset' as 'asset' | 'consumable', name: '', categoryId: '', unit: 'pcs', opening: '0', min: '', hours: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});
  const key = useRef(newKey());
  const set = (p: Partial<typeof f>) => { key.current = newKey(); setF({ ...f, ...p }); }; // an edited form is a new intent
  const isC = f.type === 'consumable';
  const save = async () => {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = 'Enter a name.';
    if (!f.categoryId) e.categoryId = 'Choose a category.';
    setErr(e); if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const body = { type: f.type, name: f.name.trim(), categoryId: f.categoryId, unit: f.unit.trim() || 'pcs',
        ...(isC ? { openingQuantity: Number(f.opening || 0), ...(f.min ? { minQuantity: Number(f.min) } : {}) } : f.hours ? { expectedReturnHours: Number(f.hours) } : {}) };
      const { data } = await post<Item>('/items', body, key.current);
      toast(`${data.name} added as ${data.itemNumber}`); await qc.invalidateQueries(); onClose(); nav(`/items/${data.id}`);
    } catch (x) { if (x instanceof ApiError && x.code === 'VALIDATION_ERROR') setErr(x.fieldErrors()); fail(x); } finally { setBusy(false); }
  };
  const byShelf = new Map<string, Cat[]>();
  for (const c of cats.data?.items ?? []) byShelf.set(c.shelfName, [...(byShelf.get(c.shelfName) ?? []), c]);
  return (
    <Modal title="Add an item" onClose={onClose}>
      <div className="seg glass" role="group" aria-label="Kind of item"><button aria-pressed={!isC} onClick={() => set({ type: 'asset', unit: 'pcs' })}>Tool or asset</button><button aria-pressed={isC} onClick={() => set({ type: 'consumable' })}>Consumable</button></div>
      <Field label="Name" error={err.name}><input value={f.name} onChange={(e) => set({ name: e.target.value })} /></Field>
      <Field label="Category" error={err.categoryId}><select value={f.categoryId} onChange={(e) => set({ categoryId: e.target.value })}><option value="">Choose…</option>{[...byShelf].map(([shelf, cs]) => <optgroup key={shelf} label={shelf}>{cs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>)}</select></Field>
      {isC ? <>
        <Field label="Unit (box, bag, pcs…)" error={err.unit}><input value={f.unit} onChange={(e) => set({ unit: e.target.value })} /></Field>
        <Field label="Quantity on the shelf now" error={err.openingQuantity}><input inputMode="numeric" value={f.opening} onChange={(e) => set({ opening: num(e.target.value) })} /></Field>
        <Field label="Minimum before it counts as low (optional)" error={err.minQuantity}><input inputMode="numeric" value={f.min} onChange={(e) => set({ min: num(e.target.value) })} /></Field>
      </> : <Field label="Expected return time in hours (optional)" error={err.expectedReturnHours}><input inputMode="numeric" value={f.hours} onChange={(e) => set({ hours: num(e.target.value) })} /></Field>}
      <div className="row-flex" style={{ justifyContent: 'flex-end' }}><Btn onClick={onClose}>Cancel</Btn><Btn className="primary" busy={busy} onClick={save}>Add item</Btn></div>
    </Modal>
  );
}
