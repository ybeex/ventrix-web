import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LogIn, Package } from 'react-feather';
import { ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Btn, Field } from '../components/ui';

export default function Login() {
  const { login, expired } = useAuth();
  const [f, setF] = useState(() => { try { return { orgSlug: localStorage.getItem('sk.org') ?? '', email: '', password: '' }; } catch { return { orgSlug: '', email: '', password: '' }; } });
  const [trust, setTrust] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { await login({ ...f, trustDevice: trust }); try { localStorage.setItem('sk.org', f.orgSlug); } catch { /* ignore */ } }
    catch (x) {
      // The server returns one identical 401 for every sign-in failure; never try to tell them apart.
      setErr(x instanceof ApiError && x.status === 401 ? 'Those details did not work. Check them and try again.' : x instanceof ApiError ? x.message : 'Could not sign in.');
    } finally { setBusy(false); }
  };
  return (
    <div className="login">
      <form className="box glass auth-login-form" onSubmit={submit}>
        <div className="brand"><i><Package className="feather-ic" /></i><span>Ventrix</span></div>
        <h1>Who has the grinder?</h1>
        {expired && <div className="alert warn glass" role="status"><div><strong>You were signed out</strong><span>Your session ended. Sign in again to continue.</span></div></div>}
        <Field label="Organization"><input autoComplete="organization" value={f.orgSlug} onChange={(e) => setF({ ...f, orgSlug: e.target.value.trim() })} required placeholder="lekki-works-supply" /></Field>
        <Field label="Email"><input type="email" autoComplete="username" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></Field>
        <Field label="Password"><input type="password" autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required /></Field>
        <label className="row" style={{ border: 0, minHeight: 44 }}><input type="checkbox" checked={trust} onChange={(e) => setTrust(e.target.checked)} /><span>This is a shared store tablet<br /><span className="muted" style={{ fontSize: 13 }}>Supervisors and admins only. Staff then switch in with a PIN.</span></span></label>
        {err && <div role="alert" style={{ color: 'var(--accent-3)', fontWeight: 700 }}>{err}</div>}
        <Btn className="primary" type="submit" busy={busy}><LogIn className="feather-ic" />Sign in</Btn>
        <p className="muted" style={{ textAlign: 'center' }}>New here? <Link to="/signup" style={{ fontWeight: 700, textDecoration: 'underline' }}>Create your organization</Link></p>
      </form>
    </div>
  );
}
