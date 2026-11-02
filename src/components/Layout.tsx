import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Activity, Bell, Tag, Briefcase, CheckSquare, Clipboard, FileText, Grid, Home, Key, Layers, LogOut, Maximize, Moon, MoreHorizontal, Package, RefreshCw, Settings, Sun, UploadCloud, UserCheck, Users, Volume2, X, AlertTriangle, User, ArrowUpRight } from 'react-feather';
import { get } from '../lib/api';
import { Bell as BellMenu } from './Bell';
import { SyncBar } from './SyncBar';
import { SetPinModal, SwitchUserButton } from './UserSwitch';
import { useAuth } from '../lib/auth';
import type { Dashboard } from '../lib/types';

type Icon = typeof Home;
interface Entry { to: string; icon: Icon; label: string; show: boolean; count?: number; hot?: boolean }
interface Group { title: string | null; items: Entry[] }

export function Layout() {
  const { me, logout, can } = useAuth();
  const loc = useLocation();
  const [pinOpen, setPinOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<string>(() => { try { return localStorage.getItem('sk.theme') ?? 'concrete'; } catch { return 'concrete'; } });
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => { document.body.dataset.theme = theme; try { localStorage.setItem('sk.theme', theme); } catch { /* ignore */ } }, [theme]);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    addEventListener('online', on); addEventListener('offline', off);
    return () => { removeEventListener('online', on); removeEventListener('offline', off); };
  }, []);
  useEffect(() => { setSheet(false); setProfileOpen(false); }, [loc.pathname]);
  useEffect(() => {
    if (!profileOpen) return;
    const onPointer = (e: PointerEvent) => { if (!profileRef.current?.contains(e.target as Node)) setProfileOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setProfileOpen(false); };
    addEventListener('pointerdown', onPointer); addEventListener('keydown', onKey);
    return () => { removeEventListener('pointerdown', onPointer); removeEventListener('keydown', onKey); };
  }, [profileOpen]);
  const dash = useQuery({ queryKey: ['dashboard'], queryFn: () => get<Dashboard>('/dashboard'), refetchInterval: 60_000 });
  const d = dash.data;
  const pending = d?.pendingApprovals ?? 0;
  const sync = d?.openSyncIssues ?? 0;
  const sup = can('supervisor'), adm = can('admin');

  // One list drives both the sidebar (desktop) and the "More" sheet (phone), so every page is reachable on both.
  const groups: Group[] = [
    { title: null, items: [{ to: '/', icon: Home, label: 'Home', show: true }] },
    { title: 'Daily', items: [
      { to: '/checkout', icon: ArrowUpRight, label: 'Check out', show: can('store_staff') },
      { to: '/outstanding', icon: Users, label: 'Outstanding', show: true, count: d?.outstanding, hot: !!d?.overdue },
    ] },
    { title: 'Stock', items: [
      { to: '/items', icon: Package, label: 'Items', show: true },
      { to: '/collections', icon: Grid, label: 'Collections', show: true },
      { to: '/low-stock', icon: AlertTriangle, label: 'Low stock', show: true, count: d?.lowStock },
      { to: '/counts', icon: Clipboard, label: 'Stock counts', show: sup },
      { to: '/labels', icon: Tag, label: 'Print labels', show: can('store_staff') },
    ] },
    { title: 'Control', items: [
      { to: '/approvals', icon: CheckSquare, label: 'Approvals', show: sup, count: pending, hot: true },
      { to: '/sync', icon: RefreshCw, label: 'Sync problems', show: sup, count: sync, hot: true },
      { to: '/activity', icon: Activity, label: 'Activity', show: sup },
      { to: '/reports', icon: FileText, label: 'Reports', show: sup },
    ] },
    { title: 'People', items: [
      { to: '/people', icon: UserCheck, label: 'People & teams', show: true },
      { to: '/jobs', icon: Briefcase, label: 'Jobs', show: true },
      { to: '/team', icon: Users, label: 'Team', show: sup },
      { to: '/announcements', icon: Volume2, label: 'Announcements', show: adm },
    ] },
    { title: 'Manage', items: [
      { to: '/layout', icon: Layers, label: 'Store layout', show: adm },
      { to: '/imports', icon: UploadCloud, label: 'Import items', show: adm },
      { to: '/notifications', icon: Bell, label: 'Notification settings', show: true },
      { to: '/settings', icon: Settings, label: 'Settings', show: adm },
    ] },
  ].map((g) => ({ ...g, items: g.items.filter((i) => i.show) })).filter((g) => g.items.length);
  const hasPinItem = me?.role !== 'admin';
  const toggleTheme = () => setTheme(theme === 'night' ? 'concrete' : 'night');
  const themeLabel = theme === 'night' ? 'Switch to light palette' : 'Switch to night palette';
  const moreBadge = sup ? pending + sync : 0;

  const Row = ({ e, onGo }: { e: Entry; onGo?: () => void }) => (
    <NavLink to={e.to} end={e.to === '/'} onClick={onGo} className={({ isActive }) => 'nv' + (isActive ? ' active' : '')}>
      <e.icon className="feather-ic" /><span className="grow">{e.label}</span>{!!e.count && <span className={'cnt' + (e.hot ? ' hot' : '')} aria-label={`${e.count} waiting`}>{e.count}</span>}
    </NavLink>
  );
  const List = ({ onGo }: { onGo?: () => void }) => <>{groups.map((g) => (
    <div key={g.title ?? 'top'}>{g.title && <div className="grp">{g.title}</div>}{g.items.map((e) => <Row key={e.to} e={e} onGo={onGo} />)}</div>
  ))}</>;

  return (
    <div className="shell">
      <aside className="side" aria-label="Main">
        <div className="orgbox"><i><Package className="feather-ic" /></i><span className="grow"><b>{me?.organization.name ?? 'StoreKeeper'}</b><small>StoreKeeper</small></span></div>
        <nav aria-label="Pages"><List /></nav>
        {hasPinItem && <button className="nv" onClick={() => setPinOpen(true)}><Key className="feather-ic" /><span className="grow">{me?.hasPin ? 'Change my PIN' : 'Set my PIN'}</span></button>}
      </aside>

      <div className="content">
        {!online && <div className="offline-bar" role="status">You are offline. Changes cannot be saved until the connection returns.</div>}
        <header className="utilbar">
          <span className="org-m">{me?.organization.name}</span>
          <SwitchUserButton />
          <BellMenu />
          <button className="btn icon sm only-desktop" onClick={toggleTheme} aria-label={themeLabel}>{theme === 'night' ? <Sun className="feather-ic" /> : <Moon className="feather-ic" />}</button>
          <div className="profile-menu" ref={profileRef}>
            <button className="btn icon sm profile-trigger" aria-label="Profile menu" aria-haspopup="menu" aria-expanded={profileOpen} onClick={() => setProfileOpen((v) => !v)}><User className="feather-ic" /></button>
            {profileOpen && <div className="profile-dropdown glass" role="menu">
              <div className="profile-identity"><b>{me?.email}</b><small>{me?.email}</small><small>{me?.role.replace('_', ' ')}</small></div>
              <Link role="menuitem" className="profile-option" to={can('admin') ? '/settings' : '/notifications'} onClick={() => setProfileOpen(false)}><Settings className="feather-ic" />{can('admin') ? 'Settings' : 'Notification settings'}</Link>
              <button role="menuitem" className="profile-option danger" onClick={() => { setProfileOpen(false); void logout(); }}><LogOut className="feather-ic" />Log out</button>
            </div>}
          </div>
        </header>
        <SyncBar />
        <main className="wrap"><Outlet /></main>
      </div>

      <nav className="tabbar" aria-label="Main">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}><Home className="feather-ic" />Home</NavLink>
        <NavLink to="/outstanding" className={({ isActive }) => (isActive ? 'active' : '')}><Users className="feather-ic" />Out{!!d?.outstanding && <span className="cnt hot">{d.outstanding}</span>}</NavLink>
        <Link to="/items?scan=1" className="scan" aria-label="Scan an item"><Maximize className="feather-ic lg" /></Link>
        <NavLink to="/items" className={({ isActive }) => (isActive ? 'active' : '')}><Package className="feather-ic" />Items</NavLink>
        <button onClick={() => setSheet(true)} aria-haspopup="dialog" aria-expanded={sheet}><MoreHorizontal className="feather-ic" />More{moreBadge > 0 && <span className="cnt hot">{moreBadge}</span>}</button>
      </nav>

      {sheet && <MoreSheet onClose={() => setSheet(false)}>
        <List onGo={() => setSheet(false)} />
        {hasPinItem && <button className="nv" onClick={() => { setSheet(false); setPinOpen(true); }}><Key className="feather-ic" /><span className="grow">{me?.hasPin ? 'Change my PIN' : 'Set my PIN'}</span></button>}
        <div className="grp">Device</div>
        <button className="nv" onClick={toggleTheme}>{theme === 'night' ? <Sun className="feather-ic" /> : <Moon className="feather-ic" />}<span className="grow">{themeLabel}</span></button>
      </MoreSheet>}
      {pinOpen && <SetPinModal onClose={() => setPinOpen(false)} />}
    </div>
  );
}

function MoreSheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('a,button')?.focus();
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', k);
    return () => { removeEventListener('keydown', k); prev?.focus(); };
  }, [onClose]);
  return (
    <div className="sheet-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} role="dialog" aria-modal="true" aria-label="All pages">
      <div className="sheet" ref={ref}>
        <div className="sheet-hd"><b>All pages</b><button className="btn icon sm" onClick={onClose} aria-label="Close"><X className="feather-ic" /></button></div>
        {children}
      </div>
    </div>
  );
}
