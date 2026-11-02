import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ArrowDownLeft, MoreVertical, Search } from 'react-feather';
import { get } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { OutstandingRow, Page } from '../lib/types';
import { dueBadge, fmtDate } from '../lib/format';
import { Badge, Btn, Empty, Menu, Skeleton } from '../components/ui';
import { useDebounced } from '../components/pickers';
import { ItemActionModal, type ActionKind, type Target } from '../components/ItemActions';

export default function Outstanding() {
  const { can, me } = useAuth();
  const [sp, setSp] = useSearchParams();
  const overdue = sp.get('overdue') === '1';
  const [q, setQ] = useState('');
  const dq = useDebounced(q.trim());
  const [act, setAct] = useState<{ kind: ActionKind; target: Target } | null>(null);
  const qr = useInfiniteQuery({
    queryKey: ['outstanding', overdue, dq],
    queryFn: ({ pageParam }) => get<Page<OutstandingRow>>('/outstanding', { limit: 25, cursor: pageParam, overdue: overdue ? 'true' : undefined, q: dq || undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  const rows = qr.data?.pages.flatMap((p) => p.items) ?? [];
  const tgt = (r: OutstandingRow): Target => ({ id: r.item.id, name: r.item.name, itemNumber: r.item.itemNumber, type: r.item.type, unit: r.item.unit, holderId: r.holder.id, holderName: r.holder.name, quantity: r.quantity });
  const write = can('store_staff');
  return (
    <>
      <section className="page-head"><h1 className="page">Outstanding</h1><p className="hero-lede">Everything currently out of the store, with the holder beside it.</p></section>
      <div className="row-flex" style={{ marginBottom: 16 }}>
        <div className="seg glass"><button aria-pressed={!overdue} onClick={() => setSp({})}>All out</button><button aria-pressed={overdue} onClick={() => setSp({ overdue: '1' })}>Overdue</button></div>
        <span className="input grow" style={{ maxWidth: 360 }}><Search className="feather-ic" /><input aria-label="Search outstanding" placeholder="Item or holder" value={q} onChange={(e) => setQ(e.target.value)} /></span>
      </div>
      <div className="glass table-wrap card" style={{ padding: 8 }}>
        {qr.isLoading ? <Skeleton rows={5} /> : qr.isError ? <Empty title="Could not load">Try again in a moment.</Empty> : !rows.length ? <Empty title={overdue ? 'Nothing is overdue' : 'Everything is in'}>{overdue ? 'Good. No item is past its due date.' : 'Nothing is checked out right now.'}</Empty> : (
          <table>
            <thead><tr><th>Item</th><th>Holder</th><th>Due</th><th>State</th><th><span className="sr">Actions</span></th></tr></thead>
            <tbody>{rows.map((r, i) => { const b = dueBadge(r.dueStatus, r.overdueByHours); return (
              <tr key={`${r.item.id}-${r.holder.id}-${i}`}>
                <td><Link to={`/items/${r.item.id}`}><b>{r.item.name}</b></Link>{r.item.type === 'consumable' && ` × ${r.quantity}`} <span className="mono">{r.item.itemNumber}</span></td>
                <td>{r.holder.name}</td>
                <td className="mono">{fmtDate(r.dueAt, me?.organization.timezone)}</td>
                <td>{r.partialReturn && <Badge cls="warn">Partial return</Badge>} {b ? <Badge cls={b.cls} live={b.cls === 'bad'}>{b.label}</Badge> : <Badge cls="neu">No due date</Badge>}</td>
                <td style={{ textAlign: 'right' }}>{write && (
                  <Menu trigger={<MoreVertical className="feather-ic" aria-label="Row actions" />}>{(close) => (<>
                    <button className="item" onClick={() => { close(); setAct({ kind: 'checkin', target: tgt(r) }); }}><ArrowDownLeft className="feather-ic" />Check in</button>
                    {r.item.type === 'asset' && <button className="item" onClick={() => { close(); setAct({ kind: 'inspect', target: tgt(r) }); }}>Send for inspection</button>}
                    <button className="item" style={{ color: 'var(--accent-3)' }} onClick={() => { close(); setAct({ kind: 'loss', target: tgt(r) }); }}>Declare lost</button>
                  </>)}</Menu>)}</td>
              </tr>); })}</tbody>
          </table>
        )}
        {qr.hasNextPage && <div style={{ padding: 12, textAlign: 'center' }}><Btn busy={qr.isFetchingNextPage} onClick={() => qr.fetchNextPage()}>Load more</Btn></div>}
      </div>
      {act && <ItemActionModal kind={act.kind} target={act.target} onClose={() => setAct(null)} />}
    </>
  );
}
