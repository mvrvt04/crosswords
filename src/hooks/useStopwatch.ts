import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A pausable stopwatch. Time only accrues while `running` is true, so the
 * caller decides what "running" means (started, not paused, tab visible,
 * not yet solved).
 */
export function useStopwatch(initialMs: number, running: boolean) {
  const [elapsedMs, setElapsedMs] = useState(initialMs);
  const accumulated = useRef(initialMs);
  const startedAt = useRef<number | null>(null);

  const read = useCallback(
    () => accumulated.current + (startedAt.current === null ? 0 : performance.now() - startedAt.current),
    [],
  );

  useEffect(() => {
    if (!running) return;
    startedAt.current = performance.now();
    const id = window.setInterval(() => setElapsedMs(read()), 250);
    return () => {
      window.clearInterval(id);
      accumulated.current = read();
      startedAt.current = null;
      setElapsedMs(accumulated.current);
    };
  }, [running, read]);

  const reset = useCallback((ms = 0) => {
    accumulated.current = ms;
    if (startedAt.current !== null) startedAt.current = performance.now();
    setElapsedMs(ms);
  }, []);

  return { elapsedMs, read, reset };
}
