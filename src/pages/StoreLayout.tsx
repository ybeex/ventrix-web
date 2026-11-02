import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Plus } from 'react-feather';
import { ApiError, get, newKey, patch, post } from '../lib/api';
import { useToast } from '../lib/toast';
import { Badge, Btn, Field, Modal, Skeleton } from '../components/ui';

interface Loc { id: string; name: string; kind: string; address?: string | null; isDefault: boolean; archivedAt?: string | null }
interface Shelf { id: string; name: string; code: string; locationId: string; cycleCountDays: number; itemCount: number; categoryCount: number; archivedAt?: string | null }
interface Cat { id: string; shelfId: string; name: string; codePrefix?: string | null; itemCount: number; defaultMinQuantity?: number | null; defaultExpectedReturnHours?: number | null; archivedAt?: string | null }
type Dlg = { kind: 'shelf'; row?: Shelf } | { kind: 'cat'; row?: Cat; shelfId?: string } | null;
const digits = (v: string) => v.replace(/\D/g, '');

export default function StoreLayout() {
  const qc = useQueryClient();
  const { toast, fail } = useToast();
  const [dlg, setDlg] = useState<Dlg>(null);
  const [archived, setArchived] = useState(false);
  const loc = useQuery({ queryKey: ['locations'], queryFn: () => get<{ items: Loc[] }>('/locations') });
  const shelves = useQuery({ queryKey: ['shelves', 'all', archived], queryFn: () => get<{ items: Shelf[] }>('/shelves', { includeArchived: archived ? 'true' : undefined }) });
  const cats = useQuery({ queryKey: ['categories', 'all', archived], queryFn: () => get<{ items: Cat[] }>('/categories', { includeArchived: archived ? 'true' : undefined }) });
  const refresh = () => qc.invalidateQueries();
  const act = async (path: string, ok: string) => { try { await post(path); toast(ok); await refresh(); } catch (e) { fail(e); } };
  return (
    <>
      <section className="page-head page-head-actions"><div><h1 className="page">Store layout</h1><p className="hero-lede">Shelves hold categories, and categories hold items. Items always sit in a category.</p></div><div className="page-head-tools">
        <Btn className="primary" onClick={() => setDlg({ kind: 'shelf' })}><Plus className="feather-ic" />New shelf</Btn>
        <label className="row" style={{ border: 0, minHeight: 44 }}><input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} />Show archived</label>
      </div></section>
      {shelves.isLoading ? <Skeleton rows={4} /> : shelves.data?.items.map((s) => (
        <div className="card glass" style={{ padding: 10, marginBottom: 16 }} key={s.id}>
          <div className="row" style={{ border: 0, flexWrap: 'wrap' }}>
            <div className="grow"><h3 style={{ margin: 0 }}>{s.name} <span className="mono">{s.code}</span></h3><div className="mono">{s.itemCount} items · counted every {s.cycleCountDays} days</div></div>
            {s.archivedAt ? <><Badge cls="neu">archived</Badge><Btn className="sm" onClick={() => act(`/shelves/${s.id}/restore`, 'Shelf restored')}>Restore</Btn></> : <>
              <Btn className="sm" onClick={() => setDlg({ kind: 'shelf', row: s })}>Edit</Btn>
              <Btn className="sm danger" onClick={() => act(`/shelves/${s.id}/archive`, 'Shelf archived')}>Archive</Btn></>}
          </div>
          {cats.data?.items.filter((c) => c.shelfId === s.id).map((c) => (
            <div className="row" key={c.id}><div className="grow">{c.name}{c.codePrefix && <span className="mono"> {c.codePrefix}</span>}<div className="mono">{c.itemCount} items</div></div>
              {c.archivedAt ? <><Badge cls="neu">archived</Badge><Btn className="sm" onClick={() => act(`/categories/${c.id}/restore`, 'Category restored')}>Restore</Btn></> : <>
                <Btn className="sm" onClick={() => setDlg({ kind: 'cat', row: c })}>Edit</Btn>
                <Btn className="sm danger" onClick={() => act(`/categories/${c.id}/archive`, 'Category archived')}>Archive</Btn></>}</div>))}
          {!s.archivedAt && <div style={{ padding: 8 }}><Btn className="sm" onClick={() => setDlg({ kind: 'cat', shelfId: s.id })}><Plus className="feather-ic" />Add category</Btn></div>}
        </div>))}
      {dlg?.kind === 'shelf' && <ShelfForm row={dlg.row} locations={loc.data?.items ?? []} onClose={() => setDlg(null)} />}
      {dlg?.kind === 'cat' && <CatForm row={dlg.row} shelfId={dlg.shelfId} shelves={shelves.data?.items.filter((s) => !s.archivedAt) ?? []} onClose={() => setDlg(null)} />}
    </>
  );
}

// Shared save wrapper: one Idempotency-Key per open dialog, regenerated when the form changes.
function useSave(onClose: () => void, ok: string) {
  const qc = useQueryClient();
  const { toast, fail } = useToast();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});
  const key = useRef(newKey());
  const run = async (fn: (k: string) => Promise<unknown>) => {
    setBusy(true); setErr({});
    try { await fn(key.current); toast(ok); await qc.invalidateQueries(); onClose(); }
    catch (e) { if (e instanceof ApiError && e.code === 'VALIDATION_ERROR') setErr(e.fieldErrors()); fail(e); } finally { setBusy(false); }
  };
  return { busy, err, run, touch: () => { key.current = newKey(); } };
}

export function LocationSettings() {
  const [dlg, setDlg] = useState<Loc | 'new' | null>(null);
  const loc = useQuery({ queryKey: ['locations'], queryFn: () => get<{ items: Loc[] }>('/locations') });
  return <div className="card glass people-table" style={{ padding: 10 }}>
    <div className="row-flex" style={{ justifyContent: 'space-between', padding: '10px 12px' }}><h3 style={{ margin: 0 }}>Locations</h3><Btn className="primary sm" onClick={() => setDlg('new')}><Plus className="feather-ic" />Add location</Btn></div>
    {loc.isLoading ? <Skeleton rows={1} /> : loc.data?.items.map((l) => (
      <div className="row" key={l.id}><div className="grow"><b>{l.name}</b> <span className="mono">{l.kind}</span>{l.address && <div className="mono">{l.address}</div>}</div>{l.isDefault && <Badge cls="info">default</Badge>}<Btn className="sm" onClick={() => setDlg(l)}>Rename</Btn></div>))}
    {dlg && <LocForm row={dlg === 'new' ? undefined : dlg} onClose={() => setDlg(null)} />}
  </div>;
}

function LocForm({ row, onClose }: { row?: Loc; onClose: () => void }) {
  const [name, setName] = useState(row?.name ?? ''); const [address, setAddress] = useState(row?.address ?? ''); const [kind, setKind] = useState('store');
  const s = useSave(onClose, row ? 'Location updated' : 'Location added');
  return (
    <Modal title={row ? 'Rename location' : 'Add a location'} onClose={onClose}>
      {!row && <p className="muted">Your plan may allow only one location. If so, the server will say so.</p>}
      <Field label="Name" error={s.err.name}><input value={name} onChange={(e) => { setName(e.target.value); s.touch(); }} /></Field>
      <Field label="Address (optional)" error={s.err.address}><input value={address} onChange={(e) => { setAddress(e.target.value); s.touch(); }} /></Field>
      {!row && <Field label="Kind"><select value={kind} onChange={(e) => setKind(e.target.value)}><option value="store">Store</option><option value="site">Site</option><option value="warehouse">Warehouse</option><option value="area">Area</option></select></Field>}
      <div className="row-flex" style={{ justifyContent: 'flex-end' }}><Btn onClick={onClose}>Cancel</Btn><Btn className="primary" busy={s.busy} disabled={!name.trim()} onClick={() => s.run((k) => row ? patch(`/locations/${row.id}`, { name: name.trim(), ...(address.trim() ? { address: address.trim() } : {}) }) : post('/locations', { name: name.trim(), kind, ...(address.trim() ? { address: address.trim() } : {}) }, k))}>Save</Btn></div>
    </Modal>
  );
}

function ShelfForm({ row, locations, onClose }: { row?: Shelf; locations: Loc[]; onClose: () => void }) {
  const [name, setName] = useState(row?.name ?? ''); const [days, setDays] = useState(String(row?.cycleCountDays ?? '')); const [locationId, setLocationId] = useState(row?.locationId ?? locations.find((l) => l.isDefault)?.id ?? locations[0]?.id ?? '');
  const s = useSave(onClose, row ? 'Shelf updated' : 'Shelf added');
  return (
    <Modal title={row ? `Edit ${row.name}` : 'New shelf'} onClose={onClose}>
      <Field label="Name" error={s.err.name}><input value={name} onChange={(e) => { setName(e.target.value); s.touch(); }} /></Field>
      <Field label="Count every (days)" error={s.err.cycleCountDays}><input inputMode="numeric" value={days} placeholder="e.g. 30" onChange={(e) => { setDays(digits(e.target.value)); s.touch(); }} /></Field>
      {locations.length > 1 && <Field label="Location"><select value={locationId} onChange={(e) => setLocationId(e.target.value)}>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></Field>}
      <div className="row-flex" style={{ justifyContent: 'flex-end' }}><Btn onClick={onClose}>Cancel</Btn><Btn className="primary" busy={s.busy} disabled={!name.trim() || !locationId} onClick={() => s.run((k) => { const body = { name: name.trim(), ...(days ? { cycleCountDays: Number(days) } : {}) }; return row ? patch(`/shelves/${row.id}`, body) : post('/shelves', { ...body, locationId }, k); })}>Save</Btn></div>
    </Modal>
  );
}

function CatForm({ row, shelfId, shelves, onClose }: { row?: Cat; shelfId?: string; shelves: Shelf[]; onClose: () => void }) {
  const [name, setName] = useState(row?.name ?? ''); const [prefix, setPrefix] = useState(row?.codePrefix ?? ''); const [min, setMin] = useState(String(row?.defaultMinQuantity ?? '')); const [hours, setHours] = useState(String(row?.defaultExpectedReturnHours ?? ''));
  const [shelf, setShelf] = useState(row?.shelfId ?? shelfId ?? shelves[0]?.id ?? '');
  const s = useSave(onClose, row ? 'Category updated' : 'Category added');
  return (
    <Modal title={row ? `Edit ${row.name}` : 'New category'} onClose={onClose}>
      <Field label="Name" error={s.err.name}><input value={name} onChange={(e) => { setName(e.target.value); s.touch(); }} /></Field>
      <Field label="Shelf"><select value={shelf} onChange={(e) => { setShelf(e.target.value); s.touch(); }}>{shelves.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
      <Field label="Item ID prefix (optional)" error={s.err.codePrefix}><input value={prefix} onChange={(e) => { setPrefix(e.target.value.toUpperCase()); s.touch(); }} /></Field>
      <Field label="Default minimum for consumables (optional)" error={s.err.defaultMinQuantity}><input inputMode="numeric" value={min} onChange={(e) => { setMin(digits(e.target.value)); s.touch(); }} /></Field>
      <Field label="Default return time in hours (optional)" error={s.err.defaultExpectedReturnHours}><input inputMode="numeric" value={hours} onChange={(e) => { setHours(digits(e.target.value)); s.touch(); }} /></Field>
      <div className="row-flex" style={{ justifyContent: 'flex-end' }}><Btn onClick={onClose}>Cancel</Btn><Btn className="primary" busy={s.busy} disabled={!name.trim() || !shelf} onClick={() => s.run(async (k) => {
        const body = { name: name.trim(), ...(prefix.trim() ? { codePrefix: prefix.trim() } : {}), ...(min ? { defaultMinQuantity: Number(min) } : {}), ...(hours ? { defaultExpectedReturnHours: Number(hours) } : {}) };
        if (!row) return post('/categories', { ...body, shelfId: shelf }, k);
        await patch(`/categories/${row.id}`, body);
        if (shelf !== row.shelfId) await post(`/categories/${row.id}/move`, { shelfId: shelf }, k);
      })}>Save</Btn></div>
    </Modal>
  );
}
