import { useQuery } from '@tanstack/react-query';
import { Download, Printer } from 'react-feather';
import { fetchBlob } from '../lib/api';
import { Btn } from './ui';

// The item's scannable tag. The server encodes the item's code (its Item ID unless a custom code was set), so what is printed
// here is exactly what scanning resolves. Needs a connection, since the image comes from the API.
export function ItemQr({ id, code, name, itemNumber }: { id: string; code: string; name: string; itemNumber: string }) {
  const q = useQuery({ queryKey: ['item', id, 'qr', code], staleTime: Infinity, retry: 1, queryFn: async () => { const b = await fetchBlob(`/items/${id}/qr`, { format: 'png' }); return { blob: b, url: URL.createObjectURL(b) }; } });
  const url = q.data?.url;

  const print = () => {
    if (!url) return;
    const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;width:0;height:0;border:0'; document.body.append(f);
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
    const doc = f.contentDocument!; doc.open();
    doc.write(`<!doctype html><title>${esc(itemNumber)}</title><style>@page{margin:8mm}body{margin:0;font:14px system-ui,sans-serif;text-align:center}.l{display:inline-block;border:1px solid #000;padding:10px 14px;width:62mm}img{width:46mm;height:46mm;display:block;margin:0 auto 6px}b{display:block;font-size:15px;overflow-wrap:anywhere}code{font-size:13px}</style><div class="l"><img src="${url}" alt=""><b>${esc(name)}</b><code>${esc(code)}</code></div>`);
    doc.close();
    const img = doc.querySelector('img')!;
    const go = () => { f.contentWindow!.focus(); f.contentWindow!.print(); setTimeout(() => f.remove(), 2000); };
    if (img.complete) go(); else img.onload = go;
  };
  const save = () => { if (!q.data) return; const a = Object.assign(document.createElement('a'), { href: q.data.url, download: `${itemNumber}-qr.png` }); document.body.append(a); a.click(); a.remove(); };

  return (
    <div className="row-flex" style={{ alignItems: 'center', gap: 16 }}>
      {q.isLoading ? <div className="skel" style={{ width: 132, height: 132 }} /> : url ? <img src={url} alt={`QR code for ${name}`} width={132} height={132} style={{ background: '#fff', padding: 6, borderRadius: 10 }} /> : <span className="muted">The QR code needs a connection. Try again when you are online.</span>}
      <div className="stack" style={{ gap: 6 }}>
        <div><div className="muted" style={{ fontSize: 13 }}>Scan code</div><span className="mono" style={{ fontSize: 16, color: 'var(--ink)' }}>{code}</span></div>
        {url && <div className="row-flex"><Btn className="sm" onClick={print}><Printer className="feather-ic" />Print label</Btn><Btn className="sm" onClick={save}><Download className="feather-ic" />Download</Btn></div>}
      </div>
    </div>
  );
}
