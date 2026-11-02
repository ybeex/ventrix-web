import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { moduleMm, perPage, type Layout } from '../lib/labels';

export interface LabelItem { id: string; code: string; name: string; itemNumber: string }

// Geometry shared by the on-screen preview and the print output, so what you see is what prints. Labels are always black on white.
export function labelGeometry(l: Layout, showName: boolean) {
  const row = l.w >= l.h * 1.35;                       // wide label: QR on the left, text on the right
  const pad = Math.min(2.5, l.h * 0.08);
  const qr = row ? Math.min(l.h - pad * 2, l.w * 0.5) : Math.min(l.w - pad * 2, l.h - pad * 2 - (showName ? 9 : 5));
  return { row, pad, qr: Math.max(8, qr) };
}

export function useQrs(items: LabelItem[]) {
  const [svgs, setSvgs] = useState<Record<string, { svg: string; modules: number }>>({});
  useEffect(() => {
    let dead = false;
    (async () => {
      const next: Record<string, { svg: string; modules: number }> = {};
      for (const it of items) {
        if (svgs[it.code]) { next[it.code] = svgs[it.code]; continue; }
        const svg = await QRCode.toString(it.code, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
        next[it.code] = { svg, modules: QRCode.create(it.code, { errorCorrectionLevel: 'M' }).modules.size };
      }
      if (!dead) setSvgs(next);
    })();
    return () => { dead = true; };
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps
  return svgs;
}

export function Label({ it, l, showName, qr, guides }: { it: LabelItem; l: Layout; showName: boolean; qr?: { svg: string }; guides: boolean }) {
  const g = labelGeometry(l, showName);
  return (
    <div className="lbl" style={{ width: `${l.w}mm`, height: `${l.h}mm`, padding: `${g.pad}mm`, flexDirection: g.row ? 'row' : 'column', outline: guides ? '0.2mm dashed #888' : 'none', gap: '1.5mm' }}>
      <div className="lbl-qr" style={{ width: `${g.qr}mm`, height: `${g.qr}mm` }} dangerouslySetInnerHTML={{ __html: qr?.svg ?? '' }} />
      <div className="lbl-txt" style={{ textAlign: g.row ? 'left' : 'center', fontSize: `${Math.max(2.6, Math.min(4, l.h / 9))}mm` }}>
        {showName && <b>{it.name}</b>}<code>{it.code}</code>
      </div>
    </div>
  );
}

/** All pages for printing: sheets lay labels out on the stock's grid; rolls make one page per label. */
export function Pages({ items, l, dx, dy, showName, guides, qrs }: { items: LabelItem[]; l: Layout; dx: number; dy: number; showName: boolean; guides: boolean; qrs: Record<string, { svg: string }> }) {
  const n = perPage(l);
  const pages = useMemo(() => { const out: LabelItem[][] = []; for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n)); return out; }, [items, n]);
  return (
    <>
      {pages.map((p, pi) => (
        <section key={pi} className="lbl-page" style={{ width: `${l.page.w}mm`, height: `${l.page.h}mm`, paddingTop: `${l.top + dy}mm`, paddingLeft: `${l.left + dx}mm`, gridTemplateColumns: `repeat(${l.cols}, ${l.w}mm)`, gridAutoRows: `${l.h}mm`, columnGap: `${l.gapX}mm`, rowGap: `${l.gapY}mm` }}>
          {p.map((it, k) => <Label key={`${it.id}-${k}`} it={it} l={l} showName={showName} qr={qrs[it.code]} guides={guides} />)}
        </section>
      ))}
    </>
  );
}
export { moduleMm };
