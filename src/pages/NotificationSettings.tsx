import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { get, put } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import type { Role } from '../lib/types';
import { Badge, Skeleton } from '../components/ui';

interface Pref { type: string; inApp: boolean; email: boolean; emailIsOrgDefault: boolean }
interface Rule { type: string; roles: Role[]; isDefault: boolean }
const LABEL: Record<string, string> = {
  low_stock: 'Stock is running low', overdue_checkout: 'Something is overdue', reconciliation_discrepancy: 'A stock count found a difference', sync_failure: 'An offline action could not be applied',
  approval_pending: 'Something needs your approval', approval_decided: 'Your request was decided', announcement: 'Announcements', cycle_count_due: 'A shelf is due for counting',
};
const ROLES: [Role, string][] = [['admin', 'Admins'], ['supervisor', 'Supervisors'], ['store_staff', 'Store staff'], ['viewer', 'Viewers']];

export default function NotificationSettings() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const { toast, fail } = useToast();
  const prefs = useQuery({ queryKey: ['notif-prefs'], queryFn: () => get<{ items: Pref[] }>('/notifications/preferences') });
  const rules = useQuery({ queryKey: ['notif-rules'], queryFn: () => get<{ items: Rule[] }>('/organization/notification-rules'), enabled: can('admin') });
  const [busy, setBusy] = useState('');
  const savePref = async (p: Pref, patch: Partial<Pick<Pref, 'inApp' | 'email'>>) => {
    setBusy(p.type);
    try { await put(`/notifications/preferences/${p.type}`, { inApp: patch.inApp ?? p.inApp, email: patch.email ?? p.email }); await qc.invalidateQueries({ queryKey: ['notif-prefs'] }); }
    catch (e) { fail(e); } finally { setBusy(''); }
  };
  const saveRule = async (r: Rule, role: Role) => {
    const roles = r.roles.includes(role) ? r.roles.filter((x) => x !== role) : [...r.roles, role];
    if (!roles.length) return fail(new Error('keep at least one role')) ;
    setBusy('rule' + r.type);
    try { await put(`/organization/notification-rules/${r.type}`, { roles }); toast('Saved'); await qc.invalidateQueries({ queryKey: ['notif-rules'] }); }
    catch (e) { fail(e); } finally { setBusy(''); }
  };
  return (
    <>
      <section className="page-head"><h1 className="page">Notifications</h1><p className="hero-lede">Choose what reaches you, and how.</p></section>
      <div className="card glass" style={{ padding: 10 }}>
        <h3 style={{ padding: '10px 12px 0' }}>My notifications</h3>
        {prefs.isLoading ? <Skeleton rows={4} /> : prefs.data?.items.map((p) => (
          <div className="row" key={p.type} style={{ flexWrap: 'wrap' }}>
            <div className="grow">{LABEL[p.type] ?? p.type}{p.emailIsOrgDefault && <div className="mono">Email follows the organization default</div>}</div>
            <label className="row" style={{ border: 0, minHeight: 44 }}><input type="checkbox" disabled={busy === p.type} checked={p.inApp} onChange={(e) => savePref(p, { inApp: e.target.checked })} />In the app</label>
            <label className="row" style={{ border: 0, minHeight: 44 }}><input type="checkbox" disabled={busy === p.type} checked={p.email} onChange={(e) => savePref(p, { email: e.target.checked })} />By email</label>
          </div>))}
      </div>
      {can('admin') && (
        <div className="card glass" style={{ padding: 10, marginTop: 20 }}>
          <h3 style={{ padding: '10px 12px 0' }}>Who is told</h3><p className="muted" style={{ padding: '0 12px' }}>Pick the roles that receive each alert. “Your request was decided” goes to whoever asked, and announcements choose their own audience.</p>
          {rules.isLoading ? <Skeleton rows={3} /> : rules.data?.items.map((r) => (
            <div className="row" key={r.type} style={{ flexWrap: 'wrap' }}>
              <div className="grow">{LABEL[r.type] ?? r.type} {r.isDefault && <Badge cls="neu">default</Badge>}</div>
              {ROLES.map(([role, l]) => <label key={role} className="row" style={{ border: 0, minHeight: 44 }}><input type="checkbox" disabled={busy === 'rule' + r.type} checked={r.roles.includes(role)} onChange={() => saveRule(r, role)} />{l}</label>)}
            </div>))}
        </div>)}
    </>
  );
}
