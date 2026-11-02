import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Maximize, Search } from 'react-feather';
import { get } from '../lib/api';
import { holdersLocal, lookupLocal, searchLocal } from '../lib/snapshot';
import type { Holder, Item, Page } from '../lib/types';
import { Badge } from './ui';
import { ScanModal } from './ScanModal';

export function useDebounced<T>(v: T, ms = 250) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

export function HolderSelect({ value, onChange, label = 'Who is taking it?' }: { value: string; onChange: (id: string, h?: Holder) => void; label?: string }) {
  const { data } = useQuery({ queryKey: ['holders', 'all'], queryFn: async () => { if (!navigator.onLine) return { items: await holdersLocal(), nextCursor: null } as Page<Holder>; try { return await get<Page<Holder>>('/holders', { limit: 100 }); } catch (e) { const l = await holdersLocal(); if (l.length) return { items: l, nextCursor: null } as Page<Holder>; throw e; } }, networkMode: 'always' });
  const recent = useQuery({ queryKey: ['holders', 'recent'], queryFn: () => get<{ items: { id: string; name: string }[] }>('/holders/recent', { limit: 5 }) });
  const list = data?.items ?? [];
  const rec = (recent.data?.items ?? []).filter((r) => list.some((h) => h.id === r.id));
  return (
    <label className="field">{label}
      <span className="input">
        <select value={value} onChange={(e) => onChange(e.target.value, list.find((h) => h.id === e.target.value))}>
          <option value="">Choose a person, team or job…</option>
          {rec.length > 0 && <optgroup label="Recent">{rec.map((r) => <option key={'r' + r.id} value={r.id}>{r.name}</option>)}</optgroup>}
          <optgroup label="Everyone">{list.map((h) => <option key={h.id} value={h.id}>{h.name} · {h.kind.replace('_', ' ')}</option>)}</optgroup>
        </select>
      </span>
    </label>
  );
}

export function ItemSearch({ onPick, filter, placeholder = 'Name, SKU or scan a tag', autoFocus, autoScan }: { onPick: (i: Item) => void; filter?: (i: Item) => boolean; placeholder?: string; autoFocus?: boolean; autoScan?: boolean }) {
  const [q, setQ] = useState('');
  const [cam, setCam] = useState(!!autoScan);
  const dq = useDebounced(q.trim());
  const [msg, setMsg] = useState('');
  const { data } = useQuery({ queryKey: ['items', 'search', dq], networkMode: 'always', enabled: dq.length > 0, queryFn: async () => { if (!navigator.onLine) return { items: await searchLocal(dq), nextCursor: null } as Page<Item>; try { return await get<Page<Item>>('/items', { q: dq, limit: 8 }); } catch (e) { const l = await searchLocal(dq); if (l.length) return { items: l, nextCursor: null } as Page<Item>; throw e; } } });
  const rows = (data?.items ?? []).filter((i) => !filter || filter(i));

  // Scanners type the full code then press Enter: try an exact lookup first.
  const exact = async (raw = q) => {
    const code = raw.trim();
    if (!code) return;
    try { const it = navigator.onLine ? await get<Item>('/items/lookup', { code }) : await lookupLocal(code); if (!it) throw new Error('none'); onPick(it); setQ(''); setMsg(''); }
    catch { const it = await lookupLocal(code); if (it) { onPick(it); setQ(''); setMsg(''); } else { setQ(code); setMsg(`No item has the code “${code}”. Pick from the list below.`); } }
  };
  return (
    <div className="stack">
      <span className="input">
        <Search className="feather-ic" />
        <input autoFocus={autoFocus} aria-label="Find an item" placeholder={placeholder} value={q} onChange={(e) => { setQ(e.target.value); setMsg(''); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void exact(); } }} />
        <button type="button" className="btn icon sm" aria-label="Scan with camera" onClick={() => setCam(true)}><Maximize className="feather-ic" /></button>
      </span>
      {cam && <ScanModal onClose={() => setCam(false)} onCode={(c) => { setCam(false); void exact(c); }} />}
      {msg && <span className="muted" role="status">{msg}</span>}
      {dq && (
        <div>
          {rows.length === 0 && data && <div className="muted" style={{ padding: 8 }}>Nothing found for “{dq}”.</div>}
          {rows.map((i) => (
            <button type="button" key={i.id} className="item" onClick={() => { onPick(i); setQ(''); }}>
              <span className="grow"><b>{i.name}</b> <span className="mono">{i.itemNumber}</span></span>
              {i.type === 'asset' ? <Badge cls={i.assetState === 'available' ? 'ok' : 'warn'}>{i.assetState?.replace('_', ' ')}</Badge> : <Badge cls={i.lowStock ? 'warn' : 'ok'}>{i.quantityAvailable} {i.unit}</Badge>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
