import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get } from '../lib/api';
import { useToast } from '../lib/toast';
import { useAuth } from '../lib/auth';

interface A { id: string; title: string; body: string; severity: string; status: string; retractedAt?: string | null }

// Show each active announcement once per browser session; the server remains the source of truth.
export function Announcements() {
  const { data } = useQuery({ queryKey: ['announcements'], queryFn: () => get<{ items: A[] }>('/announcements'), refetchInterval: 120_000 });
  const { toast } = useToast();
  const { me } = useAuth();

  useEffect(() => {
    if (!me) return;
    const seenKey = `sk.announcements.seen:${me.orgId}:${me.id}`;
    const active = (data?.items ?? []).filter((a) => !a.retractedAt && (!a.status || a.status === 'active'));
    if (!active.length) return;
    let seen: string[] = [];
    try { seen = JSON.parse(sessionStorage.getItem(seenKey) ?? '[]') as string[]; } catch { /* ignore unavailable storage */ }
    const fresh = active.filter((a) => !seen.includes(a.id));
    if (!fresh.length) return;
    try { sessionStorage.setItem(seenKey, JSON.stringify([...seen, ...fresh.map((a) => a.id)])); } catch { /* still show this visit */ }
    fresh.forEach((a) => toast(`${a.title}: ${a.body}`));
  }, [data, me?.id, me?.orgId, toast]);

  return null;
}
