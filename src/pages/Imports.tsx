import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Check, Upload as UploadIcon } from 'react-feather';
import { ApiError, get, post, upload } from '../lib/api';
import { useToast } from '../lib/toast';
import { Badge, Btn, Field } from '../components/ui';

interface Job { id: string; fileName: string; status: string; totalRows: number; importedRows: number; skippedRows: number; failedRows: number }
interface Issue { row: number; field?: string; code: string; message: string; status: 'invalid' | 'duplicate' }
interface Uploaded { import: Job; headers: string[]; suggestedMapping: Record<string, string>; sample: string[][] }
interface Summary { total: number; valid: number; invalid: number; duplicates: number; issues: Issue[]; issuesTruncated: boolean }

const FIELDS: [string, string, boolean][] = [['name', 'Name', true], ['type', 'Tool or consumable', false], ['category', 'Category', false], ['unit', 'Unit', false], ['quantity', 'Quantity on hand', false], ['minQuantity', 'Minimum', false], ['sku', 'SKU', false], ['code', 'Tag or barcode', false], ['description', 'Description', false], ['expectedReturnHours', 'Return time (hours)', false]];

export default function Imports() {
  const qc = useQueryClient();
  const { toast, fail } = useToast();
  const [up, setUp] = useState<Uploaded | null>(null);
  const [map, setMap] = useState<Record<string, string>>({});
  const [def, setDef] = useState({ type: 'consumable', unit: 'pcs', categoryId: '' });
  const [create, setCreate] = useState(false);
  const [sum, setSum] = useState<Summary | null>(null);
  const [done, setDone] = useState<{ imported: number; skipped: number; failed: number } | null>(null);
  const [busy, setBusy] = useState('');
  const cats = useQuery({ queryKey: ['categories'], queryFn: () => get<{ items: { id: string; name: string; shelfName: string }[] }>('/categories') });

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setBusy('upload'); setSum(null); setDone(null);
    try { const fd = new FormData(); fd.append('file', f); const r = await upload<Uploaded>('/imports', fd); setUp(r); setMap(r.suggestedMapping ?? {}); }
    catch (e) { fail(e); } finally { setBusy(''); }
  };
  const body = () => ({ mapping: Object.fromEntries(Object.entries(map).filter(([, v]) => v)), defaults: { type: def.type, unit: def.unit || 'pcs', ...(def.categoryId ? { categoryId: def.categoryId } : {}) }, createCategories: create });
  const validate = async () => {
    if (!up) return; setBusy('validate');
    try { const { data } = await post<{ summary: Summary }>(`/imports/${up.import.id}/validate`, body()); setSum(data.summary); }
    catch (e) { if (e instanceof ApiError && e.code === 'VALIDATION_ERROR') fail(new ApiError(400, e.code, 'The mapping has a problem. Check each column.')); else fail(e); } finally { setBusy(''); }
  };
  const commit = async () => {
    if (!up) return; setBusy('commit');
    try { const { data } = await post<{ result: { imported: number; skipped: number; failed: number } }>(`/imports/${up.import.id}/commit`); setDone(data.result); toast(`Imported ${data.result.imported} items`); await qc.invalidateQueries(); }
    catch (e) { fail(e); } finally { setBusy(''); }
  };
  const reset = () => { setUp(null); setSum(null); setDone(null); setMap({}); };

  return (
    <>
      <section className="page-head"><h1 className="page">Import items</h1><p className="hero-lede">Bring a spreadsheet in as a CSV. You check everything before anything is saved.</p></section>
      {!up && (
        <div className="card glass stack"><h3>1. Choose a CSV file</h3>
          <label className="btn primary" style={{ justifySelf: 'start' }}><UploadIcon className="feather-ic" />{busy === 'upload' ? 'Reading…' : 'Choose file'}<input type="file" accept=".csv,text/csv" className="sr" onChange={(e) => pick(e.target.files?.[0])} /></label>
          <p className="muted">The first row must be the column names. Up to 10,000 rows.</p></div>)}
      {up && !done && (
        <div className="stack">
          <div className="card glass stack imports-form"><h3>2. Match the columns</h3><p className="muted">{up.import.fileName}: {up.import.totalRows} rows. We guessed the matches. Fix any that are wrong.</p>
            <div className="settings-fields import-mapping-fields">{FIELDS.map(([k, label, req]) => (
              <Field key={k} label={label + (req ? ' (required)' : '')}><select value={map[k] ?? ''} onChange={(e) => { setMap({ ...map, [k]: e.target.value }); setSum(null); }}><option value="">{req ? 'Choose a column…' : 'Not in the file'}</option>{up.headers.map((h) => <option key={h} value={h}>{h}</option>)}</select></Field>))}
            </div>
            <h3 className="import-defaults-title">For rows that leave it blank</h3>
            <div className="settings-fields import-mapping-fields">
            <Field label="Kind"><select value={def.type} onChange={(e) => { setDef({ ...def, type: e.target.value }); setSum(null); }}><option value="consumable">Consumable</option><option value="asset">Tool or asset</option></select></Field>
            <Field label="Unit"><input value={def.unit} onChange={(e) => { setDef({ ...def, unit: e.target.value }); setSum(null); }} /></Field>
            <Field label="Category"><select value={def.categoryId} onChange={(e) => { setDef({ ...def, categoryId: e.target.value }); setSum(null); }}><option value="">None</option>{cats.data?.items.map((c) => <option key={c.id} value={c.id}>{c.shelfName} · {c.name}</option>)}</select></Field>
            </div>
            <label className="row import-create-category" style={{ border: 0 }}><input type="checkbox" checked={create} onChange={(e) => { setCreate(e.target.checked); setSum(null); }} />Create categories the file names that do not exist yet</label>
            <div className="row-flex"><Btn onClick={reset}>Choose another file</Btn><Btn className="primary" busy={busy === 'validate'} disabled={!map.name} onClick={validate}><Check className="feather-ic" />Check the file</Btn></div>
          </div>
          {sum && (
            <div className="card glass stack"><h3>3. Review</h3>
              <div className="row-flex"><Badge cls="ok">{sum.valid} ready</Badge>{sum.duplicates > 0 && <Badge cls="warn">{sum.duplicates} duplicates (skipped)</Badge>}{sum.invalid > 0 && <Badge cls="bad">{sum.invalid} with problems (skipped)</Badge>}</div>
              {sum.issues.slice(0, 20).map((i, n) => <div key={n} className="row"><span className="mono">Row {i.row}</span><span className="grow">{i.message}{i.field ? ` (${i.field})` : ''}</span><Badge cls={i.status === 'duplicate' ? 'warn' : 'bad'}>{i.status}</Badge></div>)}
              {(sum.issues.length > 20 || sum.issuesTruncated) && <p className="muted">Showing the first 20 problems.</p>}
              <div><Btn className="primary" busy={busy === 'commit'} disabled={!sum.valid} onClick={commit}>Import {sum.valid} items</Btn></div></div>)}
        </div>)}
      {done && <div className="card glass stack"><h3>Done</h3><div className="row-flex"><Badge cls="ok">{done.imported} imported</Badge>{done.skipped > 0 && <Badge cls="warn">{done.skipped} skipped</Badge>}{done.failed > 0 && <Badge cls="bad">{done.failed} failed</Badge>}</div><div><Btn onClick={reset}>Import another file</Btn></div></div>}
    </>
  );
}
