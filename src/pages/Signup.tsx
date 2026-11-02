import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle, Package } from 'react-feather';
import { ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Btn, Field } from '../components/ui';

const SITE = (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, '') ?? 'https://ventrix.app';
const zones = (): string[] => {
  try { const z = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone'); if (z?.length) return z; } catch { /* fall through */ }
  return ['Africa/Lagos', 'Africa/Accra', 'Africa/Nairobi', 'Europe/London', 'UTC'];
};

export default function Signup() {
  const { register, adopt } = useAuth();
  const nav = useNavigate();
  const list = useMemo(zones, []);
  const guess = (() => { try { const t = Intl.DateTimeFormat().resolvedOptions().timeZone; return list.includes(t) ? t : 'Africa/Lagos'; } catch { return 'Africa/Lagos'; } })();
  const [f, setF] = useState({ organizationName: '', adminName: '', email: '', password: '', timezone: guess });
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [done, setDone] = useState<{ token: string; slug: string; organization: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const submitted = useRef(false); // a double tap must not create two organizations

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitted.current) return;
    setErr(''); setFields({});
    if (f.password.length < 12) { setFields({ password: 'Use at least 12 characters.' }); return; }
    submitted.current = true; setBusy(true);
    try { setDone(await register({ ...f, organizationName: f.organizationName.trim(), adminName: f.adminName.trim(), email: f.email.trim() })); }
    catch (x) {
      submitted.current = false;
      if (x instanceof ApiError && x.status === 400) { const fe = x.fieldErrors(); setFields(fe); setErr(Object.keys(fe).length ? 'Please check the highlighted fields.' : x.message); }
      else if (x instanceof ApiError && x.status === 422) { if (x.code === 'WEAK_PASSWORD') setFields({ password: x.message }); else setErr(x.message); }
      else if (x instanceof ApiError && x.status === 429) setErr('Too many attempts. Please wait a few minutes and try again.');
      else setErr(x instanceof ApiError ? x.message : 'Could not create your organization. Check your connection and try again.');
    } finally { setBusy(false); }
  };

  if (done) {
    const enter = async () => { setBusy(true); try { await adopt(done.token); nav('/', { replace: true }); } catch { setErr('Your organization is ready, but we could not sign you in. Go to sign in and use the ID below.'); setBusy(false); } };
    return (
      <div className="login"><div className="box glass auth-success">
        <div className="brand"><i><CheckCircle className="feather-ic" /></i><span>You're all set</span></div>
        <h1>{done.organization} is ready.</h1>
        <p>Write down your <strong>organization ID</strong>. You will need it, with your email and password, every time you sign in.</p>
        <div className="glass" style={{ padding: 16, textAlign: 'center' }}>
          <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)' }} data-testid="org-id">{done.slug}</div>
          <Btn className="sm" onClick={() => { void navigator.clipboard?.writeText(done.slug).then(() => setCopied(true)).catch(() => {}); }}>{copied ? 'Copied' : 'Copy ID'}</Btn>
        </div>
        <p className="muted">We set up a starting shelf and category so you can add your first item right away.</p>
        {err && <div role="alert" style={{ color: 'var(--accent-3)', fontWeight: 700 }}>{err}</div>}
        <Btn className="primary" busy={busy} onClick={enter}><ArrowRight className="feather-ic" />Open StoreKeeper</Btn>
        <p style={{ textAlign: 'center' }}><Link to="/" style={{ textDecoration: 'underline' }}>Go to sign in instead</Link></p>
      </div></div>
    );
  }

  return (
    <div className="login">
      <form className="box glass auth-signup-form" onSubmit={submit} noValidate>
        <div className="brand"><i><Package className="feather-ic" /></i><span>StoreKeeper</span></div>
        <h1>Create your organization</h1>
        <p className="muted">Set up your store in a minute. You will be the administrator and can add your team afterwards.</p>
        <div className="auth-signup-fields">
          <Field label="Organization name" error={fields.organizationName}><input autoComplete="organization" value={f.organizationName} onChange={(e) => setF({ ...f, organizationName: e.target.value })} required minLength={2} maxLength={120} placeholder="Okafor Hardware" /></Field>
          <Field label="Your name" error={fields.adminName}><input autoComplete="name" value={f.adminName} onChange={(e) => setF({ ...f, adminName: e.target.value })} required maxLength={120} /></Field>
          <Field label="Work email" error={fields.email}><input type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></Field>
          <Field label="Password" error={fields.password}><input type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required minLength={12} maxLength={128} aria-describedby="pw-hint" /></Field>
        </div>
        <span id="pw-hint" className="muted" style={{ fontSize: 13, marginTop: -8 }}>At least 12 characters. A few words together works well.</span>
        <Field label="Time zone" error={fields.timezone}><select value={f.timezone} onChange={(e) => setF({ ...f, timezone: e.target.value })}>{list.map((z) => <option key={z}>{z}</option>)}</select></Field>
        <label className="row" style={{ border: 0, minHeight: 44 }}><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /><span>I agree to the <a href={`${SITE}/terms`} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>Terms</a> and <a href={`${SITE}/privacy`} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>Privacy Policy</a></span></label>
        {err && <div role="alert" style={{ color: 'var(--accent-3)', fontWeight: 700 }}>{err}</div>}
        <Btn className="primary" type="submit" busy={busy} disabled={!agree || !f.organizationName.trim() || !f.adminName.trim() || !f.email || !f.password}><ArrowRight className="feather-ic" />Create organization</Btn>
        <p className="muted" style={{ textAlign: 'center' }}>Already have one? <Link to="/" style={{ fontWeight: 700, textDecoration: 'underline' }}>Sign in</Link></p>
      </form>
    </div>
  );
}
