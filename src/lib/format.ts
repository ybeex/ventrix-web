import type { AssetState, DueStatus } from './types';

export const fmtDate = (iso?: string | null, tz?: string) =>
  iso ? new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', timeZone: tz }).format(new Date(iso)) : '—';
export const fmtDateTime = (iso?: string | null, tz?: string) =>
  iso ? new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: tz }).format(new Date(iso)) : '—';

export function overdueText(h: number | null | undefined) {
  if (!h) return 'Overdue';
  return h < 48 ? `Overdue ${h}h` : `Overdue ${Math.round(h / 24)} days`;
}
export function dueBadge(s: DueStatus, hours?: number | null): { cls: string; label: string } | null {
  if (s === 'overdue') return { cls: 'bad', label: overdueText(hours) };
  if (s === 'due_soon') return { cls: 'warn', label: 'Due soon' };
  if (s === 'on_time') return { cls: 'ok', label: 'On time' };
  return null;
}
export function stateBadge(s: AssetState): { cls: string; label: string } {
  switch (s) {
    case 'available': return { cls: 'ok', label: 'Available' };
    case 'checked_out': return { cls: 'warn', label: 'Checked out' };
    case 'under_repair': return { cls: 'warn', label: 'Under repair' };
    case 'damaged': return { cls: 'bad', label: 'Damaged' };
    case 'lost': return { cls: 'bad', label: 'Lost' };
    case 'retired': return { cls: 'neu', label: 'Retired' };
    default: return { cls: 'neu', label: 'In stock' };
  }
}
