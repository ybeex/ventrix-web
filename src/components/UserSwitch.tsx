import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Key, Repeat } from 'react-feather';
import { ApiError, get } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { Btn, Field, Modal } from './ui';

export function SwitchUserButton() {
  const { shared, switched, switchBack, me } = useAuth();
  const [open, setOpen] = useState(false);
  if (!shared && !switched) return null;
  return (
    <>
      {switched
        ? <button className="btn sm" onClick={switchBack} title={`Signed in as ${me?.email}`}><Repeat className="feather-ic" />Back to supervisor</button>
        : <button className="btn icon sm" onClick={() => setOpen(true)} aria-label="Switch user"><Repeat className="feather-ic" /></button>}
      {open && <SwitchModal onClose={() => setOpen(false)} />}
    </>
  );
}

function SwitchModal({ onClose }: { onClose: () => void }) {
  const { switchTo } = useAuth();
  const { toast, fail } = useToast();
  const users = useQuery({ queryKey: ['pin-users'], queryFn: () => get<{ items: { userId: string; name: string }[] }>('/auth/pin-users') });
  const [uid, setUid] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try { await switchTo(uid, pin); toast('Switched user'); onClose(); }
    catch (e) { setPin(''); fail(e instanceof ApiError && e.status === 401 ? new ApiError(401, e.code, 'That PIN did not work.') : e); } finally { setBusy(false); }
  };
  return (
    <Modal title="Who is using the tablet?" onClose={onClose}>
      {users.isLoading ? <p className="muted">Loading…</p> : !users.data?.items.length ? <p className="muted">Nobody has set a PIN yet. Staff can set one from the menu after signing in with their password.</p> : <>
        <div className="stack">{users.data.items.map((u) => <button key={u.userId} className="btn" aria-pressed={uid === u.userId} style={uid === u.userId ? { borderColor: 'var(--accent)', boxShadow: '0 0 0 3px color-mix(in srgb,var(--accent) 25%,transparent)' } : undefined} onClick={() => setUid(u.userId)}>{u.name}</button>)}</div>
        <Field label="PIN"><input type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => e.key === 'Enter' && uid && pin && go()} /></Field>
        <div className="row-flex" style={{ justifyContent: 'flex-end' }}><Btn onClick={onClose}>Cancel</Btn><Btn className="primary" busy={busy} disabled={!uid || pin.length < 4} onClick={go}>Switch</Btn></div></>}
    </Modal>
  );
}

export function SetPinModal({ onClose }: { onClose: () => void }) {
  const { setPin } = useAuth();
  const { toast, fail } = useToast();
  const [pw, setPw] = useState('');
  const [pin, setP] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try { await setPin(pw, pin); toast('PIN saved'); onClose(); } catch (e) { fail(e); } finally { setBusy(false); }
  };
  return (
    <Modal title="Set your PIN" onClose={onClose}>
      <p className="muted">A PIN lets you switch in quickly on a shared store tablet. Use 4 to 8 digits.</p>
      <Field label="Your password"><input type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
      <Field label="New PIN"><input type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setP(e.target.value.replace(/\D/g, ''))} /></Field>
      <div className="row-flex" style={{ justifyContent: 'flex-end' }}><Btn onClick={onClose}>Cancel</Btn><Btn className="primary" busy={busy} disabled={!pw || pin.length < 4} onClick={go}><Key className="feather-ic" />Save PIN</Btn></div>
    </Modal>
  );
}
