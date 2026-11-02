import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ApiError, get, patch, put } from '../lib/api';
import { useToast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import { Btn, Skeleton } from '../components/ui';
import { LocationSettings } from './StoreLayout';

type Mode = 'direct' | 'staff_approval' | 'all_approval';
interface Policy { adjustmentMode: Mode; lossMode: Mode; retirementMode: Mode; checkoutMode: Mode; checkinMode: Mode; largeAdjustmentThreshold: number }
interface Settings { requirePhotoFor: string[]; reconciliationRequireReason: boolean; staffCanManageItems: boolean; supervisorsCanInvite: boolean; dueSoonHours: number; nearMinimumPercent: number }

const OPS: [keyof Omit<Policy, 'largeAdjustmentThreshold'>, string, string][] = [
  ['checkoutMode', 'Check out', 'Handing items to a person or team'],
  ['checkinMode', 'Check in', 'Taking items back'],
  ['adjustmentMode', 'Stock adjustments', 'Corrections to a count'],
  ['lossMode', 'Losses', 'Declaring an item lost'],
  ['retirementMode', 'Retirement', 'Taking an item out of service for good'],
];
const MODES: [Mode, string][] = [['direct', 'Goes straight through'], ['staff_approval', 'Staff need approval'], ['all_approval', 'Everyone except admins needs approval']];

export default function SettingsPage() {
  const qc = useQueryClient();
  const { refreshMe } = useAuth();
  const { toast, fail } = useToast();
  const pol = useQuery({ queryKey: ['policy'], queryFn: () => get<Policy>('/organization/approval-policy') });
  const set = useQuery({ queryKey: ['org-settings'], queryFn: () => get<Settings>('/organization/settings') });
  const [p, setP] = useState<Policy | null>(null);
  const [s, setS] = useState<Settings | null>(null);
  const [busy, setBusy] = useState('');
  useEffect(() => { if (pol.data) setP(pol.data); }, [pol.data]);
  useEffect(() => { if (set.data) setS(set.data); }, [set.data]);
  if (!p || !s) return <div className="sec"><Skeleton rows={6} /></div>;
  const dirtyP = JSON.stringify(p) !== JSON.stringify(pol.data), dirtyS = JSON.stringify(s) !== JSON.stringify(set.data);
  const save = async (which: 'policy' | 'settings') => {
    setBusy(which);
    try {
      if (which === 'policy') await put('/organization/approval-policy', p); else await patch('/organization/settings', s);
      toast('Saved'); await qc.invalidateQueries(); await refreshMe();
    } catch (e) { fail(e instanceof ApiError && e.code === 'VALIDATION_ERROR' ? new ApiError(400, e.code, 'One of the numbers is out of range.') : e); } finally { setBusy(''); }
  };
  const num = (v: string) => Math.max(0, parseInt(v.replace(/\D/g, '') || '0', 10));
  return (
    <>
      <section className="page-head"><h1 className="page">Settings</h1><p className="hero-lede">Decide what staff can do directly and what waits for a supervisor.</p></section>
      <div className="stack settings-page">
        <LocationSettings />

        <div className="card glass stack settings-card"><h3>Approvals</h3>
          <div className="settings-fields">{OPS.map(([k, label, hint]) => (
            <label className="field" key={k}>{label}<span className="muted" style={{ fontWeight: 400 }}>{hint}</span>
              <span className="input"><select value={p[k]} onChange={(e) => setP({ ...p, [k]: e.target.value as Mode })}>{MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></span></label>))}
          <label className="field">Large adjustment threshold (units)<span className="muted" style={{ fontWeight: 400 }}>Adjustments at or above this always need review</span>
            <span className="input"><input inputMode="numeric" value={p.largeAdjustmentThreshold} onChange={(e) => setP({ ...p, largeAdjustmentThreshold: num(e.target.value) })} /></span></label>
          </div>
          <div><Btn className="primary" busy={busy === 'policy'} disabled={!dirtyP} onClick={() => save('policy')}>Save approvals</Btn></div>
        </div>
        <div className="card glass stack settings-card"><h3>Store rules</h3>
          {([['staffCanManageItems', 'Staff can add and edit items'], ['supervisorsCanInvite', 'Supervisors can invite people'], ['reconciliationRequireReason', 'A stock count that differs needs a reason']] as const).map(([k, l]) => (
            <label className="row" key={k} style={{ border: 0 }}><input type="checkbox" checked={s[k]} onChange={(e) => setS({ ...s, [k]: e.target.checked })} /><span className="grow">{l}</span></label>))}
          <fieldset style={{ border: 0, padding: 0 }}><legend className="field" style={{ marginBottom: 4 }}>Photo required for</legend>
            {([['checkout', 'Check out'], ['checkin', 'Check in'], ['damage', 'Damage reports'], ['adjustment', 'Stock adjustments'], ['reconciliation', 'Stock counts']] as const).map(([k, l]) => (
              <label className="row" key={k} style={{ border: 0, minHeight: 44 }}><input type="checkbox" checked={s.requirePhotoFor.includes(k)} onChange={(e) => setS({ ...s, requirePhotoFor: e.target.checked ? [...s.requirePhotoFor, k] : s.requirePhotoFor.filter((x) => x !== k) })} />{l}</label>))}</fieldset>
          <div className="settings-fields">
          <label className="field">“Due soon” window (hours)<span className="input"><input inputMode="numeric" value={s.dueSoonHours} onChange={(e) => setS({ ...s, dueSoonHours: num(e.target.value) })} /></span></label>
          <label className="field">“Near minimum” margin (percent above the minimum)<span className="input"><input inputMode="numeric" value={s.nearMinimumPercent} onChange={(e) => setS({ ...s, nearMinimumPercent: num(e.target.value) })} /></span></label>
          </div>
          <div><Btn className="primary" busy={busy === 'settings'} disabled={!dirtyS} onClick={() => save('settings')}>Save rules</Btn></div>
        </div>
      </div>
    </>
  );
}
