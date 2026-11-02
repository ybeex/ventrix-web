import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle } from 'react-feather';
import { get } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { LowStockRow, Page } from '../lib/types';
import { Badge, Btn, Empty, Skeleton } from '../components/ui';
import { ItemActionModal } from '../components/ItemActions';

export default function LowStock() {
  const { can } = useAuth();
  const [near, setNear] = useState(true);
  const [pick, setPick] = useState<LowStockRow | null>(null);
  const qr = useInfiniteQuery({
    queryKey: ['low', near],
    queryFn: ({ pageParam }) => get<Page<LowStockRow>>('/low-stock', { limit: 25, cursor: pageParam, includeNear: near ? 'true' : undefined }),
    initialPageParam: undefined as string | undefined, getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  const rows = qr.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <>
      <section className="page-head"><h1 className="page">Low stock</h1><p className="hero-lede">What to reorder, worst first.</p></section>
      <div className="seg glass" style={{ marginBottom: 16 }}><button aria-pressed={near} onClick={() => setNear(true)}>Low and near minimum</button><button aria-pressed={!near} onClick={() => setNear(false)}>Low only</button></div>
      <div className="card glass" style={{ padding: 10 }}>
        {qr.isLoading ? <Skeleton rows={4} /> : !rows.length ? <Empty title="All above minimum">Nothing needs reordering.</Empty> : rows.map((r) => (
          <div className="row" key={r.item.id}>
            <Link to={`/items/${r.item.id}`} className="grow"><b>{r.item.name}</b> <span className="mono">{r.item.itemNumber}</span><div className="mono">{r.quantity} of {r.minimum} {r.item.unit}{r.status === 'low' ? ` · short by ${r.shortfall}` : ` · ${r.headroom} above minimum`}{r.reorderQuantity ? ` · reorder ${r.reorderQuantity}` : ''}</div></Link>
            <Badge cls={r.outOfStock ? 'bad' : r.status === 'low' ? 'warn' : 'neu'}>{r.outOfStock ? 'Out of stock' : r.status === 'low' ? 'Low stock' : 'Near minimum'}</Badge>
            {can('store_staff') && <Btn className="sm" onClick={() => setPick(r)}><PlusCircle className="feather-ic" />Restock</Btn>}
          </div>))}
        {qr.hasNextPage && <div style={{ padding: 12, textAlign: 'center' }}><Btn busy={qr.isFetchingNextPage} onClick={() => qr.fetchNextPage()}>Load more</Btn></div>}
      </div>
      {pick && <ItemActionModal kind="restock" target={{ id: pick.item.id, name: pick.item.name, itemNumber: pick.item.itemNumber, type: 'consumable', unit: pick.item.unit, quantity: pick.reorderQuantity ?? Math.max(1, pick.shortfall) }} onClose={() => setPick(null)} />}
    </>
  );
}
