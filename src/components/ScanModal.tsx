import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Modal } from './ui';

// Camera scanner for item tags. Uses the browser's BarcodeDetector where it exists (fast, reads many barcode types),
// otherwise falls back to jsQR, which reads QR codes anywhere. The camera is always released when the dialog closes.
type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };
const makeDetector = (): Detector | null => {
  const BD = (globalThis as unknown as { BarcodeDetector?: new (o?: { formats: string[] }) => Detector }).BarcodeDetector;
  try { return BD ? new BD({ formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf', 'data_matrix'] }) : null; } catch { return null; }
};

export function ScanModal({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState('');
  const [ready, setReady] = useState(false);
  const cb = useRef(onCode); cb.current = onCode; // the parent re-renders freely; the camera must not restart when it does

  useEffect(() => {
    let stop = false; let stream: MediaStream | null = null; let timer = 0;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const detector = makeDetector();
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setErr('This browser cannot open the camera here. Camera scanning needs a secure (https) connection. You can type the code instead.'); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
        if (stop) { stream.getTracks().forEach((t) => t.stop()); return; }
        const v = video.current!; v.srcObject = stream; await v.play(); setReady(true);
        const tick = async () => {
          if (stop) return;
          try {
            if (v.videoWidth) {
              let code = '';
              if (detector) code = (await detector.detect(v))[0]?.rawValue ?? '';
              else if (ctx) {
                const w = Math.min(v.videoWidth, 720), h = Math.round(v.videoHeight * (w / v.videoWidth));
                canvas.width = w; canvas.height = h; ctx.drawImage(v, 0, 0, w, h);
                code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'attemptBoth' })?.data ?? '';
              }
              if (code) { stop = true; cb.current(code.trim()); return; }
            }
          } catch { /* a bad frame is not fatal */ }
          timer = window.setTimeout(tick, 150);
        };
        void tick();
      } catch (e) {
        const n = (e as DOMException)?.name;
        setErr(n === 'NotAllowedError' ? 'Camera access was blocked. Allow the camera for this site in your browser settings, or type the code instead.'
          : n === 'NotFoundError' ? 'No camera was found on this device. You can type the code instead.' : 'Could not start the camera. You can type the code instead.');
      }
    })();
    return () => { stop = true; clearTimeout(timer); stream?.getTracks().forEach((t) => t.stop()); };
  }, []);

  return (
    <Modal title="Scan a tag" onClose={onClose}>
      {err ? <p role="alert" style={{ fontWeight: 700 }}>{err}</p> : (
        <>
          <div className="scanbox"><video ref={video} playsInline muted aria-label="Camera preview" />{ready && <span className="scanframe" aria-hidden="true" />}</div>
          <p className="muted" role="status">{ready ? 'Point the camera at the QR code or barcode on the item.' : 'Starting the camera…'}</p>
        </>
      )}
      <button className="btn" onClick={onClose}>{err ? 'Close' : 'Cancel'}</button>
    </Modal>
  );
}
