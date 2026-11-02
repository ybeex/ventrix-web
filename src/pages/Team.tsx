import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Mail, UserPlus } from 'react-feather';
import { ApiError, get, newKey, patch, post } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import type { Page, Role } from '../lib/types';
import { fmtDate } from '../lib/format';
import { Badge, Btn, Empty, Field, Modal, Skeleton } from '../components/ui';

interface User { id: string; email: string; name?: string; role: Role; active: boolean; hasPassword: boolean; lastLoginAt?: string | null }
interface Invite { id: string; email: string; name?: string; role: Role; status: string; expiresAt: string }
const ROLES: [Role, string][] = [['admin', 'Admin'], ['supervisor', 'Supervisor'], ['store_staff', 'Store staff'], ['viewer', 'Viewer']];

export default function Team() {
  const { can, me } = useAuth();
  const qc = useQueryClient();
  const { toast, fail } = useToast();
  const [inviting, setInviting] = useState(false);
  const users = useQuery({ queryKey: ['users'], queryFn: () => get<Page<User>>('/users', { limit: 100 }) });
  const invites = useQuery({ queryKey: ['invites'], queryFn: () => get<Page<Invite>>('/users/invitations', { status: 'pending', limit: 50 }) });
  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); toast(ok); await qc.invalidateQueries({ queryKey: ['users'] }); await qc.invalidateQueries({ queryKey: ['invites'] }); } catch (e) { fail(e); } };
  const admin = can('admin');
  return (
    <>
      <section className="page-head page-head-actions"><div><h1 className="page">Team</h1><p className="hero-lede">Who can sign in, and what they can do.</p></div><Btn className="primary" onClick={() => setInviting(true)}><UserPlus className="feather-ic" />Invite someone</Btn></section>
      {!!invites.data?.items.length && <div className="card glass people-table" style={{ marginBottom: 20 }}><h3>Waiting to join</h3>
        {invites.data.items.map((i) => (
          <div className="row" key={i.id} style={{ flexWrap: 'wrap' }}><div className="grow"><b>{i.name || i.email}</b><div className="mono">{i.email} · {i.role.replace('_', ' ')} · expires {fmtDate(i.expiresAt)}</div></div>
            <Btn className="sm" onClick={() => act(() => post(`/users/${i.id}/invitations/resend`), 'Invitation sent again')}><Mail className="feather-ic" />Resend</Btn>
            <Btn className="sm danger" onClick={() => act(() => post(`/users/${i.id}/invitations/revoke`), 'Invitation withdrawn')}>Withdraw</Btn></div>))}</div>}
      <div className="card glass people-table" style={{ padding: 10 }}>
        {users.isLoading ? <Skeleton rows={4} /> : !users.data?.items.length ? <Empty title="No users" /> : users.data.items.map((u) => (
          <div className="row" key={u.id} style={{ flexWrap: 'wrap' }}>
            <div className="grow"><b>{u.name || u.email}</b>{u.id === me?.id && <span className="mono"> (you)</span>}<div className="mono">{u.email} · {u.lastLoginAt ? `last in ${fmtDate(u.lastLoginAt)}` : u.hasPassword ? 'never signed in' : 'invite not accepted'}</div></div>
            {!u.active && <Badge cls="neu">Deactivated</Badge>}
            {admin && u.id !== me?.id ? <>
              <span className="input" style={{ minHeight: 40 }}><select aria-label={`Role for ${u.email}`} value={u.role} onChange={(e) => act(() => patch(`/users/${u.id}`, { role: e.target.value }), 'Role changed. They are signed out of other sessions.')}>{ROLES.map(([r, l]) => <option key={r} value={r}>{l}</option>)}</select></span>
              <Btn className={'sm' + (u.active ? ' danger' : '')} onClick={() => act(() => patch(`/users/${u.id}`, { active: !u.active }), u.active ? 'Deactivated and signed out' : 'Reactivated')}>{u.active ? 'Deactivate' : 'Reactivate'}</Btn></>
              : <Badge cls="info">{u.role.replace('_', ' ')}</Badge>}
          </div>))}
      </div>
      {inviting && <Invite onClose={() => setInviting(false)} />}
    </>
  );
}

function Invite({ onClose }: { onClose: () => void }) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const { toast, fail } = useToast();
  const [f, setF] = useState({ email: '', name: '', role: 'store_staff' as Role });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});
  const key = useRef(newKey());
  const roles = can('admin') ? ROLES : ROLES.filter(([r]) => r === 'store_staff' || r === 'viewer'); // supervisors cannot grant higher roles
  const set = (p: Partial<typeof f>) => { key.current = newKey(); setF({ ...f, ...p }); };
  const send = async () => {
    setBusy(true); setErr({});
    try { await post('/users/invitations', { email: f.email.trim(), role: f.role, ...(f.name.trim() ? { name: f.name.trim() } : {}) }, key.current); toast(`Invitation sent to ${f.email}`); await qc.invalidateQueries({ queryKey: ['invites'] }); await qc.invalidateQueries({ queryKey: ['users'] }); onClose(); }
    catch (e) { if (e instanceof ApiError && e.code === 'VALIDATION_ERROR') setErr(e.fieldErrors()); fail(e); } finally { setBusy(false); }
  };
  return (
    <Modal title="Invite someone" onClose={onClose}>
      <Field label="Email" error={err.email}><input type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} /></Field>
      <Field label="Name (optional)" error={err.name}><input value={f.name} onChange={(e) => set({ name: e.target.value })} /></Field>
      <Field label="Role"><select value={f.role} onChange={(e) => set({ role: e.target.value as Role })}>{roles.map(([r, l]) => <option key={r} value={r}>{l}</option>)}</select></Field>
      <div className="row-flex" style={{ justifyContent: 'flex-end' }}><Btn onClick={onClose}>Cancel</Btn><Btn className="primary" busy={busy} disabled={!f.email} onClick={send}>Send invitation</Btn></div>
    </Modal>
  );
}
