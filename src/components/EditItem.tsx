import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { ApiError, get, newKey, patch, post } from '../lib/api';
import { useToast } from '../lib/toast';
import type { Item } from '../lib/types';
import { Btn, Field, Modal } from './ui';

const digits = (v: string) => v.replace(/\D/g, '');

export function EditItemModal({ item, onClose }: { item: Item & { expectedReturnHours?: number | null; reorderQuantity?: number | null }; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast, fail } = useToast();
  const isC = item.type === 'consumable';
  const cats = useQuery({ queryKey: ['categories'], queryFn: () => get<{ items: { id: string; name: string; shelfName: string }[] }>('/categories') });
  const [f, setF] = useState({ name: item.name, description: item.description ?? '', sku: item.sku ?? '', code: item.code ?? '', unit: item.unit, hours: String(item.expectedReturnHours ?? ''), min: String(item.minQuantity ?? ''), reorder: String(item.reorderQuantity ?? ''), categoryId: item.categoryId });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});
  const key = useRef(newKey());
  const set = (p: Partial<typeof f>) => { key.current = newKey(); setF({ ...f, ...p }); };
  const save = async () => {
    setBusy(true); setErr({});
    try {
      const body: Record<string, unknown> = {};
      if (f.name.trim() && f.name.trim() !== item.name) body.name = f.name.trim();
      if (f.description.trim() !== (item.description ?? '') && f.description.trim()) body.description = f.description.trim();
      if (f.sku.trim() !== (item.sku ?? '') && f.sku.trim()) body.sku = f.sku.trim();
      if (f.code.trim() !== (item.code ?? '') && f.code.trim()) body.code = f.code.trim();
      if (f.unit.trim() && f.unit.trim() !== item.unit) body.unit = f.unit.trim();
      if (!isC && f.hours && Number(f.hours) !== item.expectedReturnHours) body.expectedReturnHours = Number(f.hours);
      if (isC && f.min !== '' && Number(f.min) !== item.minQuantity) body.minQuantity = Number(f.min);
      if (isC && f.reorder !== '' && Number(f.reorder) !== item.reorderQuantity) body.reorderQuantity = Number(f.reorder);
      const moved = f.categoryId !== item.categoryId;
      if (!Object.keys(body).length && !moved) { onClose(); return; }
      if (Object.keys(body).length) await patch(`/items/${item.id}`, body);
      if (moved) await post(`/items/${item.id}/move`, { categoryId: f.categoryId }, key.current);
      toast('Item updated'); await qc.invalidateQueries(); onClose();
    } catch (e) { if (e instanceof ApiError && e.code === 'VALIDATION_ERROR') setErr(e.fieldErrors()); fail(e); } finally { setBusy(false); }
  };
  return (
    <Modal title={`Edit ${item.name}`} onClose={onClose}>
      <Field label="Name" error={err.name}><input value={f.name} onChange={(e) => set({ name: e.target.value })} /></Field>
      <Field label="Description" error={err.description}><input value={f.description} onChange={(e) => set({ description: e.target.value })} /></Field>
      <Field label="Category"><select value={f.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>{cats.data?.items.map((c) => <option key={c.id} value={c.id}>{c.shelfName} · {c.name}</option>)}{!cats.data && <option value={item.categoryId}>{item.categoryName}</option>}</select></Field>
      <Field label="Unit" error={err.unit}><input value={f.unit} onChange={(e) => set({ unit: e.target.value })} /></Field>
      <Field label="SKU" error={err.sku}><input value={f.sku} onChange={(e) => set({ sku: e.target.value })} /></Field>
      <Field label="Tag or barcode" error={err.code}><input value={f.code} onChange={(e) => set({ code: e.target.value })} /></Field>
      {isC ? <>
        <Field label="Minimum before low stock" error={err.minQuantity}><input inputMode="numeric" value={f.min} onChange={(e) => set({ min: digits(e.target.value) })} /></Field>
        <Field label="Reorder quantity" error={err.reorderQuantity}><input inputMode="numeric" value={f.reorder} onChange={(e) => set({ reorder: digits(e.target.value) })} /></Field>
      </> : <Field label="Expected return time (hours)" error={err.expectedReturnHours}><input inputMode="numeric" value={f.hours} onChange={(e) => set({ hours: digits(e.target.value) })} /></Field>}
      <div className="row-flex" style={{ justifyContent: 'flex-end' }}><Btn onClick={onClose}>Cancel</Btn><Btn className="primary" busy={busy} onClick={save}>Save</Btn></div>
    </Modal>
  );
}

export function ArchiveItemModal({ item, restore, onClose }: { item: Item; restore: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast, fail } = useToast();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const key = useRef(newKey());
  const go = async () => {
    setBusy(true);
    try { await post(`/items/${item.id}/${restore ? 'restore' : 'archive'}`, note.trim() ? { note: note.trim() } : {}, key.current); toast(restore ? `${item.name} restored` : `${item.name} archived`); await qc.invalidateQueries(); onClose(); }
    catch (e) { fail(e); } finally { setBusy(false); }
  };
  return (
    <Modal title={`${restore ? 'Restore' : 'Archive'} ${item.name}?`} onClose={onClose}>
      <p className="muted">{restore ? 'It will appear in searches and lists again.' : 'It disappears from searches and lists. Its history stays, and old labels still scan.'}</p>
      <Field label="Note (optional)"><input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      <div className="row-flex" style={{ justifyContent: 'flex-end' }}><Btn onClick={onClose}>Cancel</Btn><Btn className={restore ? 'primary' : 'danger'} busy={busy} onClick={go}>{restore ? 'Restore' : 'Archive'}</Btn></div>
    </Modal>
  );
}
