import { useRef, useState, type ReactNode } from 'react';
import { Camera, X } from 'react-feather';
import { ApiError, upload } from '../lib/api';
import { useAuth } from '../lib/auth';
import { prepareImage } from '../lib/image';

// Photo evidence for a transaction. Required when the organization's settings say so for this operation
// (me.settings.requirePhotoFor); otherwise offered as optional. The upload happens at submit time.
export function useSnapshot(op: string) {
  const { me } = useAuth();
  const required = !!me?.settings.requirePhotoFor.includes(op);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const online = navigator.onLine;

  /** Resolves to the snapshot file id, or undefined when no photo was taken. Throws when a required photo is missing. */
  const send = async (): Promise<string | undefined> => {
    if (!file) {
      if (required) { setError('This operation needs a photo.'); throw new ApiError(0, 'PHOTO_REQUIRED', 'Your organization requires a photo for this. Take one and try again.'); }
      return undefined;
    }
    const fd = new FormData(); fd.append('file', await prepareImage(file));
    return (await upload<{ id: string }>('/files?kind=transaction_snapshot', fd)).id;
  };
  const field: ReactNode = (
    <div className="field">
      Photo {required ? '(required)' : '(optional)'}
      {!online ? <span className="muted" style={{ fontWeight: 400 }}>{required ? 'This needs a connection because a photo is required.' : 'Photos cannot be added while offline.'}</span> : (
        <div className="row-flex">
          <label className="btn sm"><Camera className="feather-ic" />{file ? 'Retake' : 'Take a photo'}
            <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setError(''); }} /></label>
          {file && <><span className="mono">{file.name}</span><button type="button" className="btn icon sm" aria-label="Remove photo" onClick={() => { setFile(null); if (input.current) input.current.value = ''; }}><X className="feather-ic" /></button></>}
        </div>)}
      {error && <span className="errmsg" role="alert">{error}</span>}
    </div>
  );
  return { required, file, send, field, blockedOffline: required && !online };
}
