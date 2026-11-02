import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Plus } from 'react-feather';
import { ApiError, get, newKey, post } from '../lib/api';
import { useToast } from '../lib/toast';
import type { Role } from '../lib/types';
import { fmtDateTime } from '../lib/format';
import { Badge, Btn, Empty, Field, Modal, Skeleton } from '../components/ui';

interface A { id: string; title: string; body: string; severity: 'info' | 'warning' | 'critical'; status: 'active' | 'expired' | 'retracted'; audienceRoles: Role[]; delivered: number; read: number; createdAt: string }
const ROLES: [Role, string][] = [['admin', 'Admins'], ['supervisor', 'Supervisors'], ['store_staff', 'Store staff'], ['viewer', 'Viewers']];

export default function AnnouncementsAdmin() {
  const qc = useQueryClient();
  const { toast, fail } = useToast();
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ['announcements', 'all'], queryFn: () => get<{ items: A[] }>('/announcements', { all: 'true' }) });
  const retract = async (a: A) => { try { await post(`/announcements/${a.id}/retract`); toast('Announcement withdrawn'); await qc.invalidateQueries({ queryKey: ['announcements'] }); } catch (e) { fail(e); } };
  return (
    <>
      <section className="page-head page-head-actions"><div><h1 className="page">Announcements</h1><p className="hero-lede">Messages everyone in the chosen roles sees at the top of the app.</p></div><Btn className="primary" onClick={() => setOpen(true)}><Plus className="feather-ic" />New announcement</Btn></section>
      <div className="card glass people-table" style={{ padding: 10 }}>
        {q.isLoading ? <Skeleton /> : !q.data?.items.length ? <Empty title="None yet" /> : q.data.items.map((a) => (
          <div className="row" key={a.id} style={{ flexWrap: 'wrap' }}>
            <div className="grow"><b>{a.title}</b><div>{a.body}</div><div className="mono">{fmtDateTime(a.createdAt)} · {a.audienceRoles.map((r) => r.replace('_', ' ')).join(', ')} · read by {a.read} of {a.delivered}</div></div>
            <Badge cls={a.status === 'active' ? (a.severity === 'critical' ? 'bad' : a.severity === 'warning' ? 'warn' : 'info') : 'neu'}>{a.status}</Badge>
            {a.status === 'active' && <Btn className="sm danger" onClick={() => retract(a)}>Withdraw</Btn>}
          </div>))}
      </div>
      {open && <Compose onClose={() => setOpen(false)} />}
    </>
  );
}

function Compose({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { toast, fail } = useToast();
  const [f, setF] = useState({ title: '', body: '', severity: 'info', roles: ['admin', 'supervisor', 'store_staff', 'viewer'] as Role[], sendEmail: false });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});
  const key = useRef(newKey());
  const set = (p: Partial<typeof f>) => { key.current = newKey(); setF({ ...f, ...p }); };
  const toggle = (r: Role) => set({ roles: f.roles.includes(r) ? f.roles.filter((x) => x !== r) : [...f.roles, r] });
  const send = async () => {
    setBusy(true); setErr({});
    try { await post('/announcements', { title: f.title.trim(), body: f.body.trim(), severity: f.severity, audienceRoles: f.roles, sendEmail: f.sendEmail }, key.current); toast('Announcement published'); await qc.invalidateQueries({ queryKey: ['announcements'] }); onClose(); }
    catch (e) { if (e instanceof ApiError && e.code === 'VALIDATION_ERROR') setErr(e.fieldErrors()); fail(e); } finally { setBusy(false); }
  };
  return (
    <Modal title="New announcement" onClose={onClose}>
      <Field label="Title" error={err.title}><input value={f.title} onChange={(e) => set({ title: e.target.value })} /></Field>
      <Field label="Message" error={err.body}><textarea rows={4} value={f.body} onChange={(e) => set({ body: e.target.value })} /></Field>
      <Field label="Importance"><select value={f.severity} onChange={(e) => set({ severity: e.target.value })}><option value="info">Information</option><option value="warning">Warning</option><option value="critical">Critical</option></select></Field>
      <fieldset style={{ border: 0, padding: 0 }}><legend className="field" style={{ marginBottom: 6 }}>Who sees it</legend>
        {ROLES.map(([r, l]) => <label className="row" key={r} style={{ border: 0, minHeight: 44 }}><input type="checkbox" checked={f.roles.includes(r)} onChange={() => toggle(r)} />{l}</label>)}</fieldset>
      <label className="row" style={{ border: 0 }}><input type="checkbox" checked={f.sendEmail} onChange={(e) => set({ sendEmail: e.target.checked })} />Also send by email</label>
      <div className="row-flex" style={{ justifyContent: 'flex-end' }}><Btn onClick={onClose}>Cancel</Btn><Btn className="primary" busy={busy} disabled={!f.title.trim() || !f.body.trim() || !f.roles.length} onClick={send}>Publish</Btn></div>
    </Modal>
  );
}
