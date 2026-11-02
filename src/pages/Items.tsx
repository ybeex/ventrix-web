import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus } from 'react-feather';
import { useAuth } from '../lib/auth';
import { AddItemModal } from '../components/AddItem';
import { get } from '../lib/api';
import type { Item, Page } from '../lib/types';
import { stateBadge } from '../lib/format';
import { Badge, Btn, Empty, Skeleton } from '../components/ui';
import { ItemSearch } from '../components/pickers';
import { ItemActionModal, type ActionKind } from '../components/ItemActions';

export default function Items() {
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();
  const { me, can } = useAuth();
  const [adding, setAdding] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const canAdd = can('admin') || (can('store_staff') && !!me?.settings.staffCanManageItems);
  const mode = sp.get('do') as ActionKind | null;
  const categoryId = sp.get('categoryId') ?? '';
  const [shelfId, setShelfId] = useState(() => sp.get('shelfId') ?? '');
  const shelves = useQuery({ queryKey: ['shelves', 'items-filter'], queryFn: () => get<{ items: { id: string; name: string; code: string; locationId: string; cycleCountDays: number; itemCount: number; categoryCount: number }[] }>('/shelves') });
  const categories = useQuery({ queryKey: ['categories', 'items-filter'], queryFn: () => get<{ items: { id: string; name: string; shelfId: string }[] }>('/categories') });
  const categoryOptions = (categories.data?.items ?? []).filter((c) => !shelfId || c.shelfId === shelfId);
  const setCategory = (id: string) => { const next = new URLSearchParams(sp); if (id) next.set('categoryId', id); else next.delete('categoryId'); setSp(next); };
  const setShelf = (id: string) => { setShelfId(id); if (categoryId && !(categories.data?.items ?? []).some((c) => c.id === categoryId && (!id || c.shelfId === id))) setCategory(''); };
  const [type, setType] = useState<'' | 'asset' | 'consumable'>('');
  const [picked, setPicked] = useState<Item | null>(null);
  const qr = useInfiniteQuery({
    queryKey: ['items', 'list', type, categoryId, showArchived],
    queryFn: ({ pageParam }) => get<Page<Item>>('/items', { limit: 25, cursor: pageParam, type: type || undefined, categoryId, archived: showArchived ? 'true' : undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.nextCursor ?? undefined,
    enabled: !mode,
  });
  const rows = qr.data?.pages.flatMap((p) => p.items) ?? [];
  const pick = (i: Item) => (mode ? setPicked(i) : nav(`/items/${i.id}`));
  const title = mode === 'consume' ? 'Use up' : mode === 'restock' ? 'Restock' : 'Items';
  return (
    <>
      <section className="page-head page-head-actions items-page-head"><div><h1 className="page">{title}</h1><p className="hero-lede">{mode ? 'Scan the tag or search for the item.' : categoryId ? 'Showing one category. ' : 'Scan a tag to open an item, or browse the store.'}</p></div>{!mode && <div className="items-head-actions">{canAdd && <Link className="btn" to={`/labels${categoryId ? `?categoryId=${categoryId}` : ''}`}>Print label</Link>}{canAdd && <Btn className="primary" onClick={() => setAdding(true)}><Plus className="feather-ic" />Add item</Btn>}</div>}</section>
      <div className="card glass items-search" style={{ marginBottom: 16 }}><ItemSearch onPick={pick} autoFocus={sp.get('scan') === '1' || !!mode} autoScan={sp.get('scan') === '1' && matchMedia('(max-width: 899px)').matches} filter={mode ? (i) => i.type === 'consumable' : undefined} /></div>
      {mode ? null : <>
        <div className="row-flex items-filters" style={{ marginBottom: 12 }}>
          <div className="seg glass">{([['', 'All'], ['asset', 'Tools & assets'], ['consumable', 'Consumables']] as const).map(([v, l]) => <button key={v} aria-pressed={type === v} onClick={() => setType(v)}>{l}</button>)}</div>
          
          <div className="items-location-filters">
            <select className="items-filter-select" value={shelfId} onChange={(e) => setShelf(e.target.value)}><option value="">All shelves</option>{(shelves.data?.items ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            <select className="items-filter-select" value={categoryId} onChange={(e) => setCategory(e.target.value)}><option value="">All categories</option>{categoryOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          </div>
          <div className="items-filter-spacer" />
          
          {can('admin') && <label className="row" style={{ border: 0, minHeight: 44 }}><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />Archived only</label>}
        </div>
        <div className="card glass items-table" style={{ padding: 10 }}>
          {qr.isLoading ? <Skeleton rows={6} /> : !rows.length ? <Empty title="No items match" /> : rows.map((i) => { const s = stateBadge(i.type === 'asset' ? i.assetState : null); return (
            <Link key={i.id} to={`/items/${i.id}`} className="row click"><div className="grow"><b>{i.name}</b> <span className="mono">{i.itemNumber}</span><div className="mono">{i.categoryName}{i.currentHolder ? ` · with ${i.currentHolder.name}` : ''}</div></div>
              {i.type === 'asset' ? <Badge cls={s.cls}>{s.label}</Badge> : <Badge cls={i.lowStock ? 'warn' : i.nearMinimum ? 'neu' : 'ok'}>{i.quantityAvailable} {i.unit}</Badge>}</Link>); })}
          {qr.hasNextPage && <div style={{ padding: 12, textAlign: 'center' }}><Btn busy={qr.isFetchingNextPage} onClick={() => qr.fetchNextPage()}>Load more</Btn></div>}
        </div>
      </>}
      {adding && <AddItemModal onClose={() => setAdding(false)} />}
      {picked && mode && <ItemActionModal kind={mode} target={{ id: picked.id, name: picked.name, itemNumber: picked.itemNumber, type: picked.type, unit: picked.unit }} onClose={() => setPicked(null)} />}
    </>
  );
}
