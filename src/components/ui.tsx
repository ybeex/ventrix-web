import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X, Loader } from 'react-feather';

export const Badge = ({ cls, children, live }: { cls: string; children: ReactNode; live?: boolean }) => <span className={`badge ${cls}${live ? ' live' : ''}`}>{children}</span>;

export function Btn({ busy, children, className = '', ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
  return <button {...p} disabled={p.disabled || busy} className={`btn ${className}`}>{busy ? <Loader className="feather-ic spin" /> : null}{children}</button>;
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('input,select,textarea,button:not(.x)')?.focus();
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', k);
    return () => { removeEventListener('keydown', k); prev?.focus(); };
  }, [onClose]);
  return (
    <div className="backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal glass" ref={ref}>
        <button className="btn x icon sm" onClick={onClose} aria-label="Close"><X className="feather-ic" /></button>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return <label className="field">{label}<span className={'input' + (error ? ' err' : '')}>{children}</span>{error && <span className="errmsg" role="alert">{error}</span>}</label>;
}

export function Stepper({ value, onChange, min = 1, max }: { value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <div className="stepper">
      <button type="button" aria-label="Fewer" onClick={() => onChange(Math.max(min, value - 1))}>−</button>
      <output aria-live="polite">{value}</output>
      <button type="button" aria-label="More" onClick={() => onChange(max ? Math.min(max, value + 1) : value + 1)}>+</button>
    </div>
  );
}

export function Menu({ trigger, children }: { trigger: ReactNode; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const d = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', d); addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', d); removeEventListener('keydown', k); };
  }, [open]);
  return (
    <div className="dropdown" ref={ref}>
      <button className="btn sm icon" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{trigger}</button>
      {open && <div className="menu glass">{children(() => setOpen(false))}</div>}
    </div>
  );
}

export const Empty = ({ title, children }: { title: string; children?: ReactNode }) => <div className="empty"><h4>{title}</h4><p>{children}</p></div>;
export const Skeleton = ({ rows = 3 }: { rows?: number }) => <div className="stack" aria-busy="true">{Array.from({ length: rows }, (_, i) => <div key={i} className="skel" style={{ height: 44 }} />)}</div>;
