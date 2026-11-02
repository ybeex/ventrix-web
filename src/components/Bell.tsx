import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { get, post } from '../lib/api';
import type { Notice, Page } from '../lib/types';
import { fmtDateTime } from '../lib/format';
import { Menu } from './ui';
import { Bell as BellGlyph } from 'react-feather';

export function Bell() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const count = useQuery({ queryKey: ['notif', 'count'], queryFn: () => get<{ count: number }>('/notifications/unread-count'), refetchInterval: 45_000 });
  const list = useQuery({ queryKey: ['notif', 'list'], queryFn: () => get<Page<Notice>>('/notifications', { limit: 8 }), refetchInterval: 45_000 });
  const n = count.data?.count ?? 0;
  const dest = (x: Notice) => (x.entityType === 'item' && x.entityId ? `/items/${x.entityId}` : x.type === 'approval_pending' ? '/approvals' : x.type === 'low_stock' ? '/low-stock' : x.type === 'overdue_checkout' ? '/outstanding?overdue=1' : x.type === 'cycle_count_due' ? '/counts' : '/');
  const read = async (x: Notice, close: () => void) => { close(); if (!x.read) { await post(`/notifications/${x.id}/read`).catch(() => {}); qc.invalidateQueries({ queryKey: ['notif'] }); } nav(dest(x)); };
  const all = async () => { await post('/notifications/read-all').catch(() => {}); qc.invalidateQueries({ queryKey: ['notif'] }); };
  return (
    <div className="bell-menu">
      <Menu trigger={<><BellGlyph className="feather-ic" /><span className="sr">Notifications{n ? `, ${n} unread` : ''}</span>{n > 0 && <span className="bell-badge" aria-hidden="true">{n > 99 ? '99+' : n}</span>}</>}>{(close) => (
        <div className="notice-list">
          <div className="notice-heading"><b>Notifications</b>{n > 0 && <span className="badge bad">{n} unread</span>}</div>
          {list.isLoading ? <div className="muted notice-empty">Loading notifications…</div> : !list.data?.items.length ? <div className="muted notice-empty">No notifications.</div> : list.data.items.map((x) => (
            <button key={x.id} className={'notice-item' + (x.read ? '' : ' unread')} onClick={() => read(x, close)}><span className="notice-title">{x.title}</span><span className="notice-body">{x.body}</span><span className="mono">{fmtDateTime(x.createdAt)}</span></button>))}
          {n > 0 && <button className="notice-readall" onClick={all}>Mark all read</button>}
        </div>)}</Menu>
    </div>
  );
}
