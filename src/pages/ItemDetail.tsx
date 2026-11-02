import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowDownLeft, MinusCircle, PlusCircle, Search, Tool } from 'react-feather';
import { get } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { Item, Page, Txn } from '../lib/types';
import { dueBadge, fmtDateTime, stateBadge } from '../lib/format';
import { Badge, Btn, Empty, Skeleton } from '../components/ui';
import { EditItemModal, ArchiveItemModal } from '../components/EditItem';
import { PhotoButton } from '../components/PhotoButton';
import { ItemQr } from '../components/ItemQr';
import { ItemActionModal, type ActionKind } from '../components/ItemActions';

export default function ItemDetail() {
  const { id = '' } = useParams();
  const { can, me } = useAuth();
  const [act, setAct] = useState<ActionKind | null>(null);
  const [edit, setEdit] = useState<'edit' | 'archive' | 'restore' | null>(null);
  const item = useQuery({ queryKey: ['item', id], queryFn: () => get<Item>(`/items/${id}`) });
  const tl = useQuery({ queryKey: ['item', id, 'timeline'], queryFn: () => get<Page<Txn>>(`/items/${id}/timeline`, { limit: 12 }) });
  const photo = useQuery({ queryKey: ['file', item.data?.photoFileId], queryFn: () => get<{ url: string }>(`/files/${item.data!.photoFileId}`), enabled: !!item.data?.photoFileId, staleTime: 200_000 });
  const i = item.data;
  if (item.isLoading) return <div className="sec"><Skeleton rows={6} /></div>;
  if (item.isError || !i) return <Empty title="Item not found">It may belong to another organization or have been removed. <Link to="/items">Back to items</Link></Empty>;
  const isAsset = i.type === 'asset';
  const s = stateBadge(isAsset ? i.assetState : null);
  const d = dueBadge(i.dueStatus);
  const write = can('store_staff') && !i.archivedAt;
  const canEdit = !i.archivedAt && (can('admin') || (can('store_staff') && !!me?.settings.staffCanManageItems));
  const target = { id: i.id, name: i.name, itemNumber: i.itemNumber, type: i.type, unit: i.unit, holderId: i.currentHolder?.id, holderName: i.currentHolder?.name };
  const stock = i.quantityAvailable ?? 0;
  return (
    <>
      <section className="page-head"><Link to="/items" className="mono">← Items</Link></section>
      <div className="spot glass">
        <div>
          <h1 style={{ font: '900 clamp(34px,6vw,46px)/1 var(--display)' }}>{i.name}</h1>
          <div className="row-flex" style={{ margin: '8px 0' }}>{isAsset ? <Badge cls={s.cls}>{s.label}</Badge> : <Badge cls={i.lowStock ? 'warn' : 'ok'}>{i.lowStock ? 'Low stock' : i.nearMinimum ? 'Near minimum' : 'In stock'}</Badge>}{d && isAsset && i.assetState === 'checked_out' && <Badge cls={d.cls} live={d.cls === 'bad'}>{d.label}</Badge>}{i.archivedAt && <Badge cls="neu">Archived</Badge>}</div>
          <div className="stat"><span>Item ID</span><b className="mono">{i.itemNumber}</b></div>
          {i.description && <div className="stat"><span>About</span><b>{i.description}</b></div>}
          <div className="stat"><span>Shelf</span><b>{i.shelfName ?? '—'}{i.categoryName ? ` · ${i.categoryName}` : ''}</b></div>
          {isAsset ? <>
            <div className="stat"><span>Holder</span><b>{i.currentHolder?.name ?? 'In the store'}</b></div>
            <div className="stat"><span>Condition</span><b>{i.condition?.replace('_', ' ') ?? '—'}</b></div>
            {i.dueAt && <div className="stat"><span>Due</span><b>{fmtDateTime(i.dueAt, me?.organization.timezone)}</b></div>}
          </> : <>
            <div className="stat"><span>In stock</span><b>{stock} {i.unit}</b></div>
            <div className="stat"><span>Minimum</span><b>{i.effectiveMinQuantity ?? '—'}</b></div>
          </>}
          <h3 style={{ font: '700 22px var(--display)', marginTop: 18 }}>History</h3>
          {tl.isLoading ? <Skeleton rows={3} /> : !tl.data?.items.length ? <p className="muted">No movements yet.</p> : (
            <div className="tl">{tl.data.items.map((t) => <div key={t.id}><b>{fmtDateTime(t.occurredAt, me?.organization.timezone)}</b><span>{t.actor?.name ?? 'Someone'} {t.type.replace('_', ' ')}{t.holder ? ` · ${t.holder.name}` : ''}{t.quantity && !isAsset ? ` × ${t.quantity}` : ''}</span></div>)}</div>
          )}
        </div>
        <div className="frame">
          <div className="photo">{photo.data?.url ? <img src={photo.data.url} alt={i.name} /> : <Tool className="feather-ic" />}</div>
          {canEdit && <div className="row-flex"><PhotoButton itemId={i.id} has={!!i.photoFileId} /><Btn onClick={() => setEdit('edit')}>Edit details</Btn>{can('admin') && <Btn className="danger" onClick={() => setEdit('archive')}>Archive</Btn>}</div>}
          {i.archivedAt && can('admin') && <Btn className="primary" onClick={() => setEdit('restore')}>Restore item</Btn>}
          <ItemQr id={i.id} code={i.code} name={i.name} itemNumber={i.itemNumber} />
          {write ? (
            <div className="row-flex">
              {isAsset && i.assetState === 'checked_out' && <Btn className="primary" onClick={() => setAct('checkin')}><ArrowDownLeft className="feather-ic" />Check in</Btn>}
              {isAsset && i.assetState === 'available' && <Link className="btn primary" to="/checkout">Check out</Link>}
              {isAsset && i.assetState !== 'under_repair' && i.assetState !== 'retired' && <Btn onClick={() => setAct('inspect')} aria-label="Send for inspection"><Search className="feather-ic" />Inspect</Btn>}
              {!isAsset && <><Btn className="primary" onClick={() => setAct('consume')}><MinusCircle className="feather-ic" />Use up</Btn><Btn onClick={() => setAct('restock')}><PlusCircle className="feather-ic" />Restock</Btn></>}
              {i.assetState !== 'lost' && i.assetState !== 'retired' && <Btn className="danger" onClick={() => setAct('loss')}><AlertTriangle className="feather-ic" />Declare lost</Btn>}
            </div>
          ) : <p className="muted">{i.archivedAt ? 'Archived items cannot be changed.' : 'You can view this item but not change it.'}</p>}
        </div>
      </div>
      {edit === 'edit' && <EditItemModal item={i} onClose={() => setEdit(null)} />}
      {(edit === 'archive' || edit === 'restore') && <ArchiveItemModal item={i} restore={edit === 'restore'} onClose={() => setEdit(null)} />}
      {act && <ItemActionModal kind={act} target={target} onClose={() => setAct(null)} />}
    </>
  );
}
