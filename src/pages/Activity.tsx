import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { get } from '../lib/api';
import type { ActivityRow, Page } from '../lib/types';
import { fmtDateTime } from '../lib/format';
import { Badge, Btn, Empty, Skeleton } from '../components/ui';

const CAT: Record<string, string> = { Security: 'bad', Inventory: 'info', Approvals: 'warn' };

export default function ActivityPage() {
  const [cat, setCat] = useState('');
  const acts = useQuery({ queryKey: ['activity', 'actions'], queryFn: () => get<unknown>('/activity/actions') });
  const cats = Array.from(new Set(((acts.data as { items?: { category: string }[] } | undefined)?.items ?? []).map((a) => a.category)));
  const qr = useInfiniteQuery({
    queryKey: ['activity', cat],
    queryFn: ({ pageParam }) => get<Page<ActivityRow>>('/activity', { limit: 30, cursor: pageParam, category: cat || undefined }),
    initialPageParam: undefined as string | undefined, getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  const rows = qr.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <>
      <section className="page-head"><h1 className="page">Activity</h1><p className="hero-lede">Everything that happened, newest first. History is never edited.</p></section>
      {cats.length > 0 && <label className="field activity-filter">Filter by category<span className="input"><select value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All activity</option>{cats.map((c) => <option key={c} value={c}>{c}</option>)}</select></span></label>}
      <div className="card glass activity-table" style={{ padding: 10 }}>
        {qr.isLoading ? <Skeleton rows={6} /> : !rows.length ? <Empty title="No activity" /> : rows.map((r) => (
          <div className="row" key={r.id}><div className="grow">{r.summary}<div className="mono">{fmtDateTime(r.createdAt)}</div></div><Badge cls={CAT[r.category] ?? 'neu'}>{r.category}</Badge></div>))}
        {qr.hasNextPage && <div style={{ padding: 12, textAlign: 'center' }}><Btn busy={qr.isFetchingNextPage} onClick={() => qr.fetchNextPage()}>Load more</Btn></div>}
      </div>
    </>
  );
}
