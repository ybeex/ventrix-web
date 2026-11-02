// Label presets and per-device settings. A browser cannot see which printer is connected, so the person says once what they
// print on (and fine-tunes with a test print); the choice is remembered on this device.
export interface Layout { id: string; name: string; hint: string; kind: 'sheet' | 'roll'; page: { w: number; h: number }; w: number; h: number; cols: number; rows: number; gapX: number; gapY: number; top: number; left: number }
export const PRESETS: Layout[] = [
  { id: 'a4-21', name: 'A4 sticker sheet, 21 labels', hint: '63.5 × 38.1 mm, 3 × 7 (Avery L7160 and similar)', kind: 'sheet', page: { w: 210, h: 297 }, w: 63.5, h: 38.1, cols: 3, rows: 7, gapX: 2.5, gapY: 0, top: 15.1, left: 7.2 },
  { id: 'a4-8', name: 'A4 sticker sheet, 8 large labels', hint: '99.1 × 67.7 mm, 2 × 4 (Avery L7165 and similar)', kind: 'sheet', page: { w: 210, h: 297 }, w: 99.1, h: 67.7, cols: 2, rows: 4, gapX: 2.5, gapY: 0, top: 13, left: 4.65 },
  { id: 'roll-50x30', name: 'Label roll, small', hint: '50 × 30 mm, one label per page (thermal printers)', kind: 'roll', page: { w: 50, h: 30 }, w: 50, h: 30, cols: 1, rows: 1, gapX: 0, gapY: 0, top: 0, left: 0 },
  { id: 'roll-100x50', name: 'Label roll, large', hint: '100 × 50 mm, one label per page (thermal printers)', kind: 'roll', page: { w: 100, h: 50 }, w: 100, h: 50, cols: 1, rows: 1, gapX: 0, gapY: 0, top: 0, left: 0 },
];
export interface LabelPrefs { presetId: string; custom: Layout; dx: number; dy: number; name: boolean; guides: boolean }
const KEY = 'sk.labels';
export const customDefault: Layout = { id: 'custom', name: 'Custom', hint: 'Your own sizes', kind: 'roll', page: { w: 60, h: 40 }, w: 60, h: 40, cols: 1, rows: 1, gapX: 0, gapY: 0, top: 0, left: 0 };
export const loadPrefs = (): LabelPrefs | null => { try { const p = JSON.parse(localStorage.getItem(KEY) ?? 'null'); return p?.presetId ? { dx: 0, dy: 0, name: true, guides: false, custom: customDefault, ...p } : null; } catch { return null; } };
export const savePrefs = (p: LabelPrefs) => { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ } };
export const layoutOf = (p: LabelPrefs): Layout => PRESETS.find((x) => x.id === p.presetId) ?? p.custom;
export const perPage = (l: Layout) => Math.max(1, l.cols * l.rows);
/** Smallest QR module (one dark square) in mm. Under ~0.35 mm a thermal printer or a phone camera struggles. */
export const moduleMm = (qrMm: number, modules: number) => qrMm / (modules + 4);
