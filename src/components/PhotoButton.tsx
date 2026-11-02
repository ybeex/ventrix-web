import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Camera } from 'react-feather';
import { patch, upload } from '../lib/api';
import { prepareImage } from '../lib/image';
import { useToast } from '../lib/toast';

export function PhotoButton({ itemId, has }: { itemId: string; has: boolean }) {
  const qc = useQueryClient();
  const { toast, fail } = useToast();
  const [busy, setBusy] = useState(false);
  const pick = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    try {
      const fd = new FormData(); fd.append('file', await prepareImage(f));
      const file = await upload<{ id: string }>('/files?kind=item_photo', fd);
      await patch(`/items/${itemId}`, { photoFileId: file.id });
      toast('Photo saved'); await qc.invalidateQueries({ queryKey: ['item', itemId] }); await qc.invalidateQueries({ queryKey: ['file'] });
    } catch (e) { fail(e); } finally { setBusy(false); }
  };
  return (
    <label className="btn" aria-busy={busy}><Camera className="feather-ic" />{busy ? 'Saving…' : has ? 'Change photo' : 'Add photo'}
      <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr" disabled={busy} onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} /></label>
  );
}
