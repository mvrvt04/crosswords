import { useCallback, useEffect, useRef, useState } from 'react';

export type ToastTone = 'neutral' | 'success' | 'error';

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
  action?: { label: string; onClick: () => void };
}

/** A single transient message. A new toast replaces the previous one. */
export function useToast(timeoutMs = 5000) {
  const [toast, setToast] = useState<Toast | null>(null);
  const counter = useRef(0);

  const dismiss = useCallback(() => setToast(null), []);

  const show = useCallback((next: Omit<Toast, 'id' | 'tone'> & { tone?: ToastTone }) => {
    counter.current += 1;
    setToast({ id: counter.current, tone: 'neutral', ...next });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(dismiss, toast.action ? timeoutMs * 1.6 : timeoutMs);
    return () => window.clearTimeout(id);
  }, [toast, timeoutMs, dismiss]);

  return { toast, show, dismiss };
}
