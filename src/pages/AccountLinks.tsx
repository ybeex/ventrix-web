// Pages behind the links in invite and password-reset e-mails (and the "Forgot your password?" request form).
// The one-time token is read from the URL once and immediately scrubbed from the address bar and history, so it
// cannot leak through screenshots, shared screens or a Referer header on later navigation.
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Package } from 'react-feather';
import { ApiError, request } from '../lib/api';
import { deviceId, useAuth } from '../lib/auth';
import { Btn, Field } from '../components/ui';

function useOneTimeToken(): string {
  const [token] = useState(() => new URLSearchParams(location.search).get('token') ?? '');
  useEffect(() => { if (location.search) history.replaceState(null, '', location.pathname); }, []);
  return token;
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="login"><div className="box glass auth-login-form">
    <div className="brand"><i><Package className="feather-ic" /></i><span>Ventrix</span></div>
    <h1>{title}</h1>{children}
  </div></div>;
}

function PasswordFields({ pw, setPw, again, setAgain }: { pw: string; setPw: (v: string) => void; again: string; setAgain: (v: string) => void }) {
  return <>
    <Field label="New password"><input type="password" autoComplete="new-password" minLength={12} value={pw} onChange={(e) => setPw(e.target.value)} required /></Field>
    <Field label="Repeat password"><input type="password" autoComplete="new-password" minLength={12} value={again} onChange={(e) => setAgain(e.target.value)} required /></Field>
    <p className="muted">At least 12 characters. Avoid your name, email or common phrases.</p>
  </>;
}

const failure = (x: unknown) => x instanceof ApiError
  ? (x.status === 429 ? 'Too many attempts. Please wait a few minutes and try again.' : x.code === 'INVALID_TOKEN' ? 'This link is invalid, expired or already used. Ask for a new one.' : x.message)
  : 'Could not reach the server. Check your connection and try again.';

export function AcceptInvite() {
  const token = useOneTimeToken();
  const { adopt } = useAuth();
  const nav = useNavigate();
  const [pw, setPw] = useState(''); const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const once = useRef(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (once.current) return; setErr('');
    if (pw !== again) { setErr('The passwords do not match.'); return; }
    once.current = true; setBusy(true);
    try {
      const { data } = await request<{ token: string }>('POST', '/auth/accept-invite', { body: { token, password: pw, deviceId: deviceId() }, auth: false });
      await adopt(data.token); nav('/', { replace: true });
    } catch (x) { once.current = false; setErr(failure(x)); setBusy(false); }
  };
  if (!token) return <Shell title="Invitation link needed"><p>Open the link from your invitation e-mail. It can only be used once.</p><p><Link to="/" style={{ textDecoration: 'underline' }}>Go to sign in</Link></p></Shell>;
  return <Shell title="Welcome to Ventrix"><form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
    <p>Choose a password to finish setting up your account.</p>
    <PasswordFields pw={pw} setPw={setPw} again={again} setAgain={setAgain} />
    {err && <div role="alert" style={{ color: 'var(--accent-3)', fontWeight: 700 }}>{err}</div>}
    <Btn className="primary" type="submit" busy={busy}>Create password and sign in</Btn>
  </form></Shell>;
}

export function ResetPassword() {
  const token = useOneTimeToken();
  const [pw, setPw] = useState(''); const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [done, setDone] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    if (pw !== again) { setErr('The passwords do not match.'); return; }
    setBusy(true);
    try { await request('POST', '/auth/password-reset/confirm', { body: { token, password: pw }, auth: false }); setDone(true); }
    catch (x) { setErr(failure(x)); } finally { setBusy(false); }
  };
  if (done) return <Shell title="Password updated"><p>Your password was changed and every other session was signed out. Sign in with the new one.</p><p><Link to="/" style={{ fontWeight: 700, textDecoration: 'underline' }}>Go to sign in</Link></p></Shell>;
  if (!token) return <Shell title="Reset link needed"><p>Open the link from your password reset e-mail, or request a new one.</p><p><Link to="/forgot-password" style={{ textDecoration: 'underline' }}>Request a reset link</Link></p></Shell>;
  return <Shell title="Choose a new password"><form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
    <PasswordFields pw={pw} setPw={setPw} again={again} setAgain={setAgain} />
    {err && <div role="alert" style={{ color: 'var(--accent-3)', fontWeight: 700 }}>{err}</div>}
    <Btn className="primary" type="submit" busy={busy}>Update password</Btn>
  </form></Shell>;
}

export function ForgotPassword() {
  const [f, setF] = useState(() => { try { return { orgSlug: localStorage.getItem('sk.org') ?? '', email: '' }; } catch { return { orgSlug: '', email: '' }; } });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [sent, setSent] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { await request('POST', '/auth/password-reset/request', { body: { orgSlug: f.orgSlug.trim().toLowerCase(), email: f.email.trim() }, auth: false }); setSent(true); }
    catch (x) { setErr(failure(x)); } finally { setBusy(false); }
  };
  // The server answers identically whether or not the account exists, and so does this page: no account enumeration.
  if (sent) return <Shell title="Check your e-mail"><p>If that account exists, a reset link is on its way. It works once and expires in an hour.</p><p><Link to="/" style={{ textDecoration: 'underline' }}>Back to sign in</Link></p></Shell>;
  return <Shell title="Reset your password"><form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
    <Field label="Organization"><input value={f.orgSlug} onChange={(e) => setF({ ...f, orgSlug: e.target.value })} required placeholder="lekki-works-supply" /></Field>
    <Field label="Email"><input type="email" autoComplete="username" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></Field>
    {err && <div role="alert" style={{ color: 'var(--accent-3)', fontWeight: 700 }}>{err}</div>}
    <Btn className="primary" type="submit" busy={busy}>Send reset link</Btn>
    <p style={{ textAlign: 'center' }}><Link to="/" style={{ textDecoration: 'underline' }}>Back to sign in</Link></p>
  </form></Shell>;
}
