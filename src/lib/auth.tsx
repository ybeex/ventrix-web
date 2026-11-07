import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { get, getToken, post, setToken, setUnauthorizedHandler, request } from './api';
import type { Me, Role } from './types';
import { clearSnapshot } from './snapshot';
import { setQueueOwner } from './offline';

interface Ctx { me: Me | null; register: (f: { organizationName: string; adminName: string; email: string; password: string; timezone: string }) => Promise<{ token: string; slug: string; organization: string }>; adopt: (token: string) => Promise<void>; login: (f: { orgSlug: string; email: string; password: string; trustDevice?: boolean }) => Promise<void>; shared: boolean; switched: boolean; switchTo: (userId: string, pin: string) => Promise<void>; switchBack: () => Promise<void>; setPin: (password: string, pin: string) => Promise<void>; logout: () => Promise<void>; can: (min: Role) => boolean; expired: boolean; booting: boolean; refreshMe: () => Promise<void> }
const AuthCtx = createContext<Ctx>(null!);
export const useAuth = () => useContext(AuthCtx);
// Session persistence. The token lives in sessionStorage (this tab only, gone when the tab closes), never localStorage,
// and a signed-in tab with no activity for IDLE_MS is signed out. Set VITE_PERSIST_SESSION=false to keep it in memory only.
const PERSIST = import.meta.env.VITE_PERSIST_SESSION !== 'false';
const IDLE_MS = (Number(import.meta.env.VITE_IDLE_MINUTES) || 30) * 60_000;
const SK = 'sk.session';
const saveSession = (token: string) => { if (!PERSIST) return; try { sessionStorage.setItem(SK, JSON.stringify({ token, at: Date.now() })); } catch { /* memory only */ } };
const dropSession = () => { try { sessionStorage.removeItem(SK); } catch { /* ignore */ } };
const readSession = (): { token: string; at: number } | null => { try { const s = JSON.parse(sessionStorage.getItem(SK) ?? 'null'); return s && Date.now() - s.at < IDLE_MS ? s : null; } catch { return null; } };
const rank: Record<Role, number> = { viewer: 0, store_staff: 1, supervisor: 2, admin: 3 };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [expired, setExpired] = useState(false);
  const [booting, setBooting] = useState(() => PERSIST && !!readSession());
  // Shared devices: the supervisor/admin session stays in memory so staff can switch by PIN and back again.
  const [home, setHome] = useState<{ token: string; me: Me } | null>(null);
  const qc = useQueryClient();

  const clear = useCallback(() => { void clearSnapshot(); dropSession(); setToken(null); setMe(null); setHome(null); qc.clear(); }, [qc]);
  // The offline queue is bound to whoever is signed in (see offline.ts): a different user never sees or replays someone else's queued actions.
  useEffect(() => { setQueueOwner(me?.id ?? null); }, [me?.id]);
  useEffect(() => setUnauthorizedHandler(() => { clear(); setExpired(true); }), [clear]);

  const login: Ctx['login'] = async (f) => {
    const { data } = await request<{ token: string }>('POST', '/auth/login', { body: { ...f, deviceId: deviceId() }, auth: false });
    setToken(data.token);
    setMe(await get<Me>('/auth/me'));
    saveSession(data.token);
    setExpired(false);
  };

  // Self-serve sign-up. Creating the organization does not sign the tab in yet: the sign-up page first shows the organization ID
  // (needed to sign in later), then calls adopt() to start the session.
  const register: Ctx['register'] = async (f) => {
    const { data } = await request<{ session: { token: string }; organization: { name: string; slug: string } }>('POST', '/auth/register-org', { body: { ...f, deviceId: deviceId() }, auth: false });
    try { localStorage.setItem('sk.org', data.organization.slug); } catch { /* ignore */ }
    return { token: data.session.token, slug: data.organization.slug, organization: data.organization.name };
  };
  const adopt = async (token: string) => { setToken(token); setMe(await get<Me>('/auth/me')); saveSession(token); setExpired(false); };

  // Restore a session after a refresh.
  useEffect(() => {
    const s = readSession();
    if (!PERSIST || !s) { dropSession(); setBooting(false); return; }
    setToken(s.token);
    get<Me>('/auth/me').then((m) => { setMe(m); saveSession(s.token); }).catch(() => { setToken(null); dropSession(); }).finally(() => setBooting(false));
  }, []);

  // Idle sign-out: any interaction refreshes the stamp; a quiet tab ends the session.
  useEffect(() => {
    if (!me || !PERSIST) return;
    let last = Date.now();
    const bump = () => { const n = Date.now(); if (n - last > 15_000) { last = n; const t = getToken(); if (t) saveSession(t); } else last = n; };
    const evs = ['pointerdown', 'keydown', 'scroll'] as const;
    evs.forEach((e) => addEventListener(e, bump, { passive: true }));
    const t = setInterval(() => { if (Date.now() - last > IDLE_MS) { void post('/auth/logout').catch(() => {}); clear(); setExpired(true); } }, 30_000);
    return () => { evs.forEach((e) => removeEventListener(e, bump)); clearInterval(t); };
  }, [me, clear]);
  const shared = !!me?.trustedDevice && me.sessionKind === 'primary' && !home;
  const switched = !!home;
  const switchTo = async (userId: string, pin: string) => {
    const base = home ?? { token: getToken()!, me: me! };
    setToken(base.token); // pin-switch is called with the trusted device's own session
    try {
      // A wrong PIN is a 401 too, but it must not end the trusted device's own session.
      const { data } = await request<{ token: string }>('POST', '/auth/pin-switch', { body: { userId, pin }, keepSessionOn401: true });
      setToken(data.token);
      const next = await get<Me>('/auth/me');
      setHome(base); setMe(next); saveSession(data.token); qc.clear();
    } catch (e) { setToken(base.token); throw e; }
  };
  const switchBack = async () => {
    if (!home) return;
    try { await post('/auth/logout'); } catch { /* the PIN session may already be gone */ }
    setToken(home.token); setMe(home.me); setHome(null); saveSession(home.token); qc.clear();
  };
  const setPin = async (password: string, pin: string) => { // A wrong password must not sign the person out.
    await request('PUT', '/auth/pin', { body: { password, pin }, keepSessionOn401: true });
    setMe(me ? { ...me, hasPin: true } : me); };
  const logout = async () => { try { await post('/auth/logout'); } catch { /* session may already be gone */ } clear(); };
  const refreshMe = async () => { setMe(await get<Me>('/auth/me')); };
  const can = (min: Role) => !!me && rank[me.role] >= rank[min];
  const value = useMemo(() => ({ me, register, adopt, login, logout, can, expired, booting, refreshMe, shared, switched, switchTo, switchBack, setPin }), [me, expired, booting, home]); // eslint-disable-line react-hooks/exhaustive-deps
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

// Stable per-browser id (≥4 chars) used for session device labelling and later offline sync.
export function deviceId() {
  try { let d = localStorage.getItem('sk.device'); if (!d) { d = crypto.randomUUID(); localStorage.setItem('sk.device', d); } return d; } catch { return 'web-' + Math.random().toString(36).slice(2, 10); }
}
