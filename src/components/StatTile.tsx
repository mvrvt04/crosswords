import { useEffect, useRef, useState } from 'react';
import styles from './StatTile.module.css';

interface StatTileProps {
  label: string;
  /** Numeric value to count up to, or null when there is nothing yet. */
  value: number | null;
  /** How to print the (animated) number. */
  format?: (value: number) => string;
  /** Shown when value is null. */
  empty?: string;
  hint?: string;
  tone?: 'default' | 'accent' | 'ok';
}

/** A dashboard number that counts up on first paint. Respects reduced motion. */
export function StatTile({ label, value, format = (v) => String(Math.round(v)), empty = '–', hint, tone = 'default' }: StatTileProps) {
  const shown = useCountUp(value ?? 0, 900);
  return (
    <div className={`${styles.tile} ${styles[tone]}`}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value === null ? empty : format(shown)}</span>
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}

/** Eases from the previous value to `target` over `duration` ms. */
export function useCountUp(target: number, duration: number): number {
  const [current, setCurrent] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || duration <= 0) {
      fromRef.current = target;
      setCurrent(target);
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = from + (target - from) * eased;
      setCurrent(value);
      if (t < 1) frame = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return current;
}
