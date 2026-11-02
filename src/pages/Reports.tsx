import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Download } from 'react-feather';
import { download, get } from '../lib/api';
import { useToast } from '../lib/toast';
import { Btn, Empty, Skeleton } from '../components/ui';

interface Def { name: string; title: string; description: string }
interface Out { report: string; columns: { key: string; label: string }[]; rows: Record<string, unknown>[]; nextCursor: string | null }
const cell = (v: unknown) => (v === null || v === undefined ? '—' : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v) ? new Date(v).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : typeof v === 'object' ? JSON.stringify(v) : String(v));

export default function Reports() {
  const { fail, toast } = useToast();
  const defs = useQuery({ queryKey: ['reports'], queryFn: () => get<{ items: Def[] }>('/reports') });
  const [name, setName] = useState('');
  const active = name || defs.data?.items[0]?.name || '';
  const [busy, setBusy] = useState(false);
  const qr = useInfiniteQuery({
    queryKey: ['report', active],
    queryFn: ({ pageParam }) => get<Out>(`/reports/${active}`, { limit: 50, cursor: pageParam }),
    initialPageParam: undefined as string | undefined, getNextPageParam: (p) => p.nextCursor ?? undefined, enabled: !!active,
  });
  const cols = qr.data?.pages[0]?.columns ?? [];
  const rows = qr.data?.pages.flatMap((p) => p.rows) ?? [];
  const def = defs.data?.items.find((d) => d.name === active);
  const csv = async () => { setBusy(true); try { await download(`/reports/${active}`, { format: 'csv' }, `${active}-${new Date().toISOString().slice(0, 10)}.csv`); toast('Download started'); } catch (e) { fail(e); } finally { setBusy(false); } };
  return (
    <>
      <section className="page-head page-head-actions reports-page-head"><div><h1 className="page">Reports</h1><p className="hero-lede">{def?.description ?? 'Pick a report to read it here or download it as a spreadsheet.'}</p></div>{!defs.isLoading && <Btn onClick={csv} busy={busy} disabled={!active}><Download className="feather-ic" />Download CSV</Btn>}</section>
      {defs.isLoading ? <Skeleton rows={2} /> : (
        <div className="row-flex" style={{ marginBottom: 16 }}>
          <div className="seg glass">{defs.data?.items.map((d) => <button key={d.name} aria-pressed={d.name === active} onClick={() => setName(d.name)}>{d.title}</button>)}</div>
        </div>)}
      <div className="glass table-wrap card reports-table-wrap" style={{ padding: 0 }}>
        {qr.isLoading ? <Skeleton rows={5} /> : !rows.length ? <Empty title="Nothing to report" /> : (
          <table className="reports-table"><thead><tr>{cols.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
            <tbody>{rows.map((r, i) => <tr key={i}>{cols.map((c) => <td key={c.key}>{cell(r[c.key])}</td>)}</tr>)}</tbody></table>)}
        {qr.hasNextPage && <div style={{ padding: 12, textAlign: 'center' }}><Btn busy={qr.isFetchingNextPage} onClick={() => qr.fetchNextPage()}>Load more</Btn></div>}
      </div>
    </>
  );
}
