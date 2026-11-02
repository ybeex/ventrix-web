import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle } from 'react-feather';
import { ApiError } from './api';

interface T { id: number; msg: string; error?: boolean }
const Ctx = createContext<{ toast: (m: string) => void; fail: (e: unknown) => void }>(null!);
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<T[]>([]);
  const push = useCallback((msg: string, error?: boolean) => {
    const id = Date.now() + Math.random();
    setList((l) => [...l, { id, msg, error }]);
    setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), 5200);
  }, []);
  const toast = useCallback((m: string) => push(m), [push]);
  const fail = useCallback((e: unknown) => {
    const m = e instanceof ApiError ? e.message + (e.requestId && e.status >= 500 ? ` (ref ${e.requestId})` : '') : 'Something went wrong.';
    push(m, true);
  }, [push]);
  return (
    <Ctx.Provider value={{ toast, fail }}>
      {children}
      <div id="toasts" aria-live="polite">
        {list.map((t) => (
          <div key={t.id} className={'toast glass' + (t.error ? ' error' : '')} role={t.error ? 'alert' : 'status'}>
            {t.error ? <AlertCircle className="feather-ic" /> : <CheckCircle className="feather-ic" />}<span>{t.msg}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
