import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Maximize, MinusCircle, PlusCircle } from 'react-feather';
import { get } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { Dashboard, LowStockRow, OutstandingRow, Page } from '../lib/types';
import { dueBadge, fmtDate } from '../lib/format';
import { Badge, Empty, Skeleton } from '../components/ui';

export default function Home() {
  const { me, can } = useAuth();
  const nav = useNavigate();
  const d = useQuery({ queryKey: ['dashboard'], queryFn: () => get<Dashboard>('/dashboard') });
  const out = useQuery({ queryKey: ['outstanding', 'home'], queryFn: () => get<Page<OutstandingRow>>('/outstanding', { limit: 6 }) });
  const low = useQuery({ queryKey: ['low', 'home'], queryFn: () => get<Page<LowStockRow>>('/low-stock', { limit: 5, includeNear: true }) });
  const x = d.data;
  const write = can('store_staff');
  const A = ({ to, icon: I, children }: { to: string; icon: typeof Maximize; children: string }) => <button className="act glass" onClick={() => nav(to)}><i><I className="feather-ic lg" /></i>{children}</button>;
  return (
    <>
      <section className="page-head">
        <h1 className="page">Who has the grinder?</h1>
        <p className="hero-lede">Know what {me?.organization.name} has, who has it, and what went missing.</p>
      </section>
      {write && (
        <section className="sec"><div className="actions">
          <A to="/checkout" icon={ArrowUpRight}>Check out</A>
          <A to="/outstanding" icon={ArrowDownLeft}>Check in</A>
          <A to="/items?do=consume" icon={MinusCircle}>Use up</A>
          <A to="/items?do=restock" icon={PlusCircle}>Restock</A>
          <A to="/items?scan=1" icon={Maximize}>Scan</A>
        </div></section>
      )}
      <section className="sec">
        {!!x?.overdue && (
          <div className="alert glass" role="alert"><AlertTriangle className="feather-ic lg" style={{ color: 'var(--accent-3)' }} />
            <div className="grow"><strong>{x.overdue} {x.overdue === 1 ? 'item is' : 'items are'} overdue</strong><span>Past their due date and still out of the store.</span></div>
            <Link className="btn" to="/outstanding?overdue=1">Review</Link></div>
        )}
        <div className="kpis">
          {d.isLoading ? Array.from({ length: 4 }, (_, i) => <div key={i} className="kpi glass skel" style={{ height: 110 }} />) : <>
            <Link className="kpi glass" to="/outstanding"><small>Items out</small><div className="num">{x?.outstanding ?? 0}</div><span className="badge neu">of {x?.activeItems ?? 0} active</span></Link>
            <Link className="kpi glass hot" to="/outstanding?overdue=1"><small>Overdue</small><div className="num">{x?.overdue ?? 0}</div><span className={'badge ' + (x?.dueSoon ? 'warn' : 'neu')}>{x?.dueSoon ?? 0} due soon</span></Link>
            <Link className="kpi glass" to="/low-stock"><small>Low stock</small><div className="num">{x?.lowStock ?? 0}</div><span className="badge warn">{x?.nearMinimum ?? 0} near minimum</span></Link>
            <Link className="kpi glass good" to={can('supervisor') ? '/approvals' : '/'}><small>Awaiting approval</small><div className="num">{x?.pendingApprovals ?? 0}</div><span className="badge neu">{x?.todayTransactions ?? 0} moves today</span></Link>
          </>}
        </div>
      </section>
      <section className="sec grid2">
        <div className="card glass"><h3>Outstanding</h3>
          {out.isLoading ? <Skeleton /> : !out.data?.items.length ? <Empty title="Everything is in">Nothing is checked out right now.</Empty> :
            out.data.items.map((r, i) => { const b = dueBadge(r.dueStatus, r.overdueByHours); return (
              <Link key={i} to={`/items/${r.item.id}`} className="row click"><div className="grow"><b>{r.item.name}</b>{r.item.type === 'consumable' && ` × ${r.quantity}`}<div className="mono">{r.item.itemNumber} · {r.holder.name}</div></div>{b && <Badge cls={b.cls} live={b.cls === 'bad'}>{b.label}</Badge>}</Link>); })}
          <div style={{ marginTop: 12 }}><Link className="btn sm" to="/outstanding">See all</Link></div>
        </div>
        <div className="card glass"><h3>Low stock</h3>
          {low.isLoading ? <Skeleton /> : !low.data?.items.length ? <Empty title="All above minimum" /> :
            low.data.items.map((r) => (
              <Link key={r.item.id} to={`/items/${r.item.id}`} className="row click"><div className="grow"><b>{r.item.name}</b><div className="mono">{r.quantity} of {r.minimum} {r.item.unit}</div></div><Badge cls={r.status === 'low' ? 'warn' : 'neu'}>{r.outOfStock ? 'Out' : r.status === 'low' ? 'Low stock' : 'Near minimum'}</Badge></Link>))}
          <div style={{ marginTop: 12 }}><Link className="btn sm" to="/low-stock">See all</Link></div>
        </div>
      </section>
      <p className="mono" style={{ paddingBottom: 8 }}>{x && `Updated ${fmtDate(x.generatedAt, x.timezone)}`}</p>
    </>
  );
}
