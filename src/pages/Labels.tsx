import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { Printer, Settings } from 'react-feather';
import { get } from '../lib/api';
import type { Item, Page } from '../lib/types';
import { Btn, Empty, Field, Modal, Skeleton } from '../components/ui';
import { useDebounced } from '../components/pickers';
import { Label, Pages, labelGeometry, moduleMm, useQrs, type LabelItem } from '../components/LabelSheet';
import { PRESETS, customDefault, layoutOf, loadPrefs, perPage, savePrefs, type LabelPrefs, type Layout } from '../lib/labels';

const CAP = 500;
const toLabel = (i: Item): LabelItem => ({ id: i.id, code: i.code, name: i.name, itemNumber: i.itemNumber });

export default function Labels() {
  const [sp] = useSearchParams();
  const [prefs, setPrefs] = useState<LabelPrefs | null>(() => loadPrefs());
  const [setup, setSetup] = useState(() => !loadPrefs());
  const [q, setQ] = useState(sp.get('q') ?? '');
  const [categoryId, setCategoryId] = useState(sp.get('categoryId') ?? '');
  const [sel, setSel] = useState<Map<string, LabelItem>>(new Map());
  const [copies, setCopies] = useState(1);
  const [busyAll, setBusyAll] = useState(false);
  const dq = useDebounced(q.trim());
  const cats = useQuery({ queryKey: ['categories'], queryFn: () => get<{ items: { id: string; name: string; shelfName: string }[] }>('/categories') });
  const list = useInfiniteQuery({
    queryKey: ['labels', 'items', dq, categoryId],
    queryFn: ({ pageParam }) => get<Page<Item>>('/items', { limit: 50, cursor: pageParam, q: dq || undefined, categoryId: categoryId || undefined }),
    initialPageParam: undefined as string | undefined, getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  const rows = list.data?.pages.flatMap((p) => p.items) ?? [];

  const update = (p: LabelPrefs) => { setPrefs(p); savePrefs(p); };
  const toggle = (i: Item) => setSel((m) => { const n = new Map(m); if (n.has(i.id)) n.delete(i.id); else if (n.size < CAP) n.set(i.id, toLabel(i)); return n; });
  const selectLoaded = () => setSel((m) => { const n = new Map(m); for (const i of rows) if (n.size < CAP) n.set(i.id, toLabel(i)); return n; });
  const selectAllMatching = async () => {
    setBusyAll(true);
    try {
      const n = new Map(sel); let cursor: string | undefined;
      do { const p = await get<Page<Item>>('/items', { limit: 100, cursor, q: dq || undefined, categoryId: categoryId || undefined }); for (const i of p.items) if (n.size < CAP) n.set(i.id, toLabel(i)); cursor = p.nextCursor ?? undefined; } while (cursor && n.size < CAP);
      setSel(n);
    } finally { setBusyAll(false); }
  };

  const chosen = useMemo(() => [...sel.values()], [sel]);
  const printList = useMemo(() => chosen.flatMap((c) => Array.from({ length: copies }, () => c)).slice(0, CAP), [chosen, copies]);
  const qrs = useQrs(chosen);
  const layout = prefs ? layoutOf(prefs) : PRESETS[0];

  // Page size for the print dialog must match the stock, so inject @page while this screen is open.
  useEffect(() => {
    const s = document.createElement('style');
    s.textContent = `@page{size:${layout.page.w}mm ${layout.page.h}mm;margin:0}`;
    document.head.append(s);
    return () => s.remove();
  }, [layout.page.w, layout.page.h]);

  const g = labelGeometry(layout, prefs?.name ?? true);
  const worst = chosen.reduce((m, c) => { const q = qrs[c.code]; return q ? Math.min(m, moduleMm(g.qr, q.modules)) : m; }, 9);
  const tooDense = chosen.length > 0 && worst < 0.35;
  const pages = Math.ceil(printList.length / perPage(layout));
  const sample = chosen[0] ?? { id: 'x', code: 'AST-0001', name: 'Sample item', itemNumber: 'AST-0001' };
  const sampleQr = useQrs(chosen.length ? [] : [sample]);

  const doPrint = (test: boolean) => {
    if (!prefs) return;
    if (test) update({ ...prefs, guides: true });
    setTimeout(() => window.print(), 50);
  };

  return (
    <>
      <section className="page-head"><h1 className="page">Print labels</h1><p className="hero-lede">Pick the items, check the preview, print. Labels carry the QR code people scan.</p></section>

      <div className="grid2 labels-layout" style={{ alignItems: 'start' }}>
        <div className="card glass labels-chooser">
          <h3>1. Choose items</h3>
          <div className="row-flex labels-filters" style={{ marginBottom: 10 }}>
            <span className="input grow"><input aria-label="Search items" placeholder="Search name, SKU or code" value={q} onChange={(e) => setQ(e.target.value)} /></span>
            <span className="input"><select aria-label="Category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">All categories</option>{cats.data?.items.map((c) => <option key={c.id} value={c.id}>{c.shelfName} · {c.name}</option>)}</select></span>
          </div>
          <div className="row-flex labels-selection-controls" style={{ marginBottom: 6 }}>
            <Btn className="sm" onClick={selectLoaded}>Select shown</Btn>
            <Btn className="sm" busy={busyAll} onClick={selectAllMatching}>Select all matching</Btn>
            <Btn className="sm" onClick={() => setSel(new Map())} disabled={!sel.size}>Clear</Btn>
            <span className="muted" role="status">{sel.size} selected{sel.size >= CAP ? ` (limit ${CAP})` : ''}</span>
          </div>
          <div className="labels-item-list">
            {list.isLoading ? <Skeleton rows={5} /> : !rows.length ? <Empty title="No items match" /> : rows.map((i) => (
              <label key={i.id} className="row"><input type="checkbox" checked={sel.has(i.id)} onChange={() => toggle(i)} /><span className="grow"><b>{i.name}</b> <span className="mono">{i.code}</span></span></label>
            ))}
            {list.hasNextPage && <div style={{ padding: 10, textAlign: 'center' }}><Btn className="sm" busy={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>Load more</Btn></div>}
          </div>
        </div>

        <div className="stack labels-tools">
          <div className="card glass labels-size">
            <h3>2. Label size</h3>
            <p><b>{layout.name}</b><br /><span className="muted">{layout.hint}</span></p>
            <div className="row-flex">
              <Btn className="sm" onClick={() => setSetup(true)}><Settings className="feather-ic" />Change label type</Btn>
              <label className="row" style={{ border: 0, minHeight: 40 }}><input type="checkbox" checked={prefs?.name ?? true} onChange={(e) => prefs && update({ ...prefs, name: e.target.checked })} />Show item name</label>
            </div>
            <div className="row-flex" style={{ marginTop: 8 }}>
              <Field label="Copies of each"><input type="number" min={1} max={20} value={copies} onChange={(e) => setCopies(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} /></Field>
            </div>
            <div className="row-flex" style={{ marginTop: 8 }}>
              <Field label="Shift right (mm)"><input type="number" step={0.1} min={-10} max={10} value={prefs?.dx ?? 0} onChange={(e) => prefs && update({ ...prefs, dx: Number(e.target.value) || 0 })} /></Field>
              <Field label="Shift down (mm)"><input type="number" step={0.1} min={-10} max={10} value={prefs?.dy ?? 0} onChange={(e) => prefs && update({ ...prefs, dy: Number(e.target.value) || 0 })} /></Field>
            </div>
            <p className="muted" style={{ fontSize: 13 }}>If labels land slightly off the stickers, print a test and shift them here. Your choices stay on this device.</p>
          </div>

        </div>

        <div className="card glass labels-preview-card">
            <h3>3. Preview and print</h3>
            <div className="lblprev" aria-label="Label preview"><div className="lbl-preview-scale" style={{ transform: `scale(${Math.min(1, 300 / (layout.w * 3.78))})`, transformOrigin: 'top left', width: `${layout.w}mm`, height: `${layout.h}mm` }}>
              {prefs && <Label it={sample} l={layout} showName={prefs.name} qr={(chosen.length ? qrs : sampleQr)[sample.code]} guides />}
            </div></div>
            {tooDense && <p role="alert" style={{ color: 'var(--accent-3)', fontWeight: 700 }}>One or more codes are long, so the QR is very dense at this size and may be hard to scan. Use a larger label or shorter item codes.</p>}
            <p className="muted">{printList.length ? `${printList.length} label${printList.length === 1 ? '' : 's'} on ${pages} ${layout.kind === 'roll' ? 'roll label' : 'sheet'}${pages === 1 ? '' : 's'}.` : 'Select items to print.'}</p>
            <div className="row-flex labels-print-actions">
              <Btn className="primary" disabled={!printList.length} onClick={() => doPrint(false)}><Printer className="feather-ic" />Print {printList.length || ''} label{printList.length === 1 ? '' : 's'}</Btn>
              <Btn disabled={!printList.length} onClick={() => doPrint(true)}>Print a test (with outlines)</Btn>
            </div>
            <p className="muted" style={{ fontSize: 13 }}>In the print dialog choose your printer, set paper size to match the label, margins to “None” and scale to 100%.</p>
        </div>
      </div>

      {createPortal(<div className="print-root" aria-hidden="true">{prefs && <Pages items={printList.slice(0, CAP)} l={layout} dx={prefs.dx} dy={prefs.dy} showName={prefs.name} guides={prefs.guides} qrs={qrs} />}</div>, document.body)}
      {setup && <SetupModal initial={prefs} onClose={() => setSetup(false)} onSave={(p) => { update(p); setSetup(false); }} />}
    </>
  );
}

function SetupModal({ initial, onClose, onSave }: { initial: LabelPrefs | null; onClose: () => void; onSave: (p: LabelPrefs) => void }) {
  const [pick, setPick] = useState(initial?.presetId ?? PRESETS[0].id);
  const [c, setC] = useState<Layout>(initial?.custom ?? customDefault);
  const num = (k: keyof Layout) => (e: React.ChangeEvent<HTMLInputElement>) => setC({ ...c, [k]: Number(e.target.value) || 0 });
  const save = () => {
    const custom: Layout = { ...c, id: 'custom', name: 'Custom', hint: `${c.w} × ${c.h} mm`, kind: c.cols * c.rows > 1 ? 'sheet' : 'roll', page: c.cols * c.rows > 1 ? c.page : { w: c.w, h: c.h }, cols: Math.max(1, Math.round(c.cols)), rows: Math.max(1, Math.round(c.rows)) };
    onSave({ dx: 0, dy: 0, name: true, guides: false, ...initial, presetId: pick, custom });
  };
  return (
    <Modal title="What will you print on?" onClose={onClose}>
      <p className="muted">Browsers cannot see which printer you have, so tell us the label type once. We remember it on this device.</p>
      <div role="radiogroup" aria-label="Label type">
        {[...PRESETS, { ...customDefault, name: 'Something else (custom size)' }].map((p) => (
          <label key={p.id} className="row" style={{ alignItems: 'flex-start' }}><input type="radio" name="lt" checked={pick === p.id} onChange={() => setPick(p.id)} /><span><b>{p.name}</b><br /><span className="muted">{p.hint}</span></span></label>
        ))}
      </div>
      {pick === 'custom' && (
        <div className="row-flex custom-label-fields">
          <Field label="Label width (mm)"><input type="number" step={0.1} value={c.w} onChange={num('w')} /></Field>
          <Field label="Label height (mm)"><input type="number" step={0.1} value={c.h} onChange={num('h')} /></Field>
          <Field label="Columns"><input type="number" min={1} value={c.cols} onChange={num('cols')} /></Field>
          <Field label="Rows"><input type="number" min={1} value={c.rows} onChange={num('rows')} /></Field>
          <Field label="Gap across (mm)"><input type="number" step={0.1} value={c.gapX} onChange={num('gapX')} /></Field>
          <Field label="Gap down (mm)"><input type="number" step={0.1} value={c.gapY} onChange={num('gapY')} /></Field>
          <Field label="Top margin (mm)"><input type="number" step={0.1} value={c.top} onChange={num('top')} /></Field>
          <Field label="Left margin (mm)"><input type="number" step={0.1} value={c.left} onChange={num('left')} /></Field>
          <Field label="Page width (mm)"><input type="number" step={0.1} value={c.page.w} onChange={(e) => setC({ ...c, page: { ...c.page, w: Number(e.target.value) || 0 } })} /></Field>
          <Field label="Page height (mm)"><input type="number" step={0.1} value={c.page.h} onChange={(e) => setC({ ...c, page: { ...c.page, h: Number(e.target.value) || 0 } })} /></Field>
        </div>
      )}
      <Btn className="primary" onClick={save}>Use this</Btn>
    </Modal>
  );
}
