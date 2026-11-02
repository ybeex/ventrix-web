import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Layers, Package } from 'react-feather';
import { get } from '../lib/api';
import type { CollectionShelf, Stats } from '../lib/types';
import { Badge, Empty, Skeleton } from '../components/ui';

const attn = (s: Stats): { cls: string; label: string } => {
  if (s.overdue) return { cls: 'bad', label: `${s.overdue} overdue` };
  if (s.lowStock) return { cls: 'warn', label: `${s.lowStock} low stock` };
  if (s.damaged || s.lost || s.underRepair) return { cls: 'warn', label: `${s.damaged + s.lost + s.underRepair} need attention` };
  if (s.nearMinimum) return { cls: 'neu', label: `${s.nearMinimum} near minimum` };
  return { cls: 'ok', label: 'All good' };
};
const line = (s: Stats) => [s.assets && `${s.assets} assets${s.checkedOut ? `, ${s.checkedOut} out` : ''}`, s.products && `${s.products} products, ${s.units} units`].filter(Boolean).join(' · ') || 'Empty';

export default function Collections() {
  const { data, isLoading } = useQuery({ queryKey: ['collections'], queryFn: () => get<{ shelves: CollectionShelf[] }>('/collections') });
  const [open, setOpen] = useState<string | null>(null);
  const shelf = data?.shelves.find((s) => s.id === open);
  return (
    <>
      <section className="page-head"><h1 className="page">Collections</h1><p className="hero-lede">Browse the store by shelf. Each folder shows what is in, what is out and what needs attention.</p></section>
      {isLoading ? <Skeleton rows={3} /> : !data?.shelves.length ? <Empty title="No shelves yet" /> : !shelf ? (
        <div className="folders">{data.shelves.map((s) => { const a = attn(s.stats); return (
          <button key={s.id} className="folder" onClick={() => setOpen(s.id)}><span className="peek" /><span className="peek" />
            <span className="front glass"><i className="ic"><Package className="feather-ic lg" /></i><strong>{s.name}</strong><span className="mono">{line(s.stats)}</span><span><Badge cls={a.cls}>{a.label}</Badge></span></span></button>); })}</div>
      ) : (
        <>
          <button className="btn sm" onClick={() => setOpen(null)} style={{ marginBottom: 16 }}>← All shelves</button>
          <h2 style={{ font: '900 40px var(--display)', marginBottom: 12 }}>{shelf.name} <span className="mono">{shelf.code}</span></h2>
          <div className="folders">{shelf.categories.map((c) => { const a = attn(c.stats); return (
            <Link key={c.id} to={`/items?categoryId=${c.id}&shelfId=${shelf.id}`} className="folder"><span className="peek" /><span className="peek" />
              <span className="front glass"><i className="ic"><Layers className="feather-ic lg" /></i><strong>{c.name}</strong><span className="mono">{line(c.stats)}</span><span><Badge cls={a.cls}>{a.label}</Badge></span></span></Link>); })}</div>
        </>
      )}
    </>
  );
}
