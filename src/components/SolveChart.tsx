import { useEffect, useId, useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { isClean } from '../services/stats';
import type { GameRecord } from '../services/types';
import { formatDuration } from '../utils/time';
import { IconCheck, IconSparkle } from './Icons';
import styles from './SolveChart.module.css';

interface SolveChartProps {
  /** History, newest first (as the API returns it). */
  history: GameRecord[];
  limit?: number;
}

const HEIGHT = 220;
const PAD = { top: 26, right: 8, bottom: 28, left: 44 };
const MAX_BAR = 24;

/** Nice tick step in seconds for a given maximum. */
function tickStep(maxSeconds: number): number {
  const candidates = [15, 30, 60, 120, 300, 600, 900, 1800, 3600];
  return candidates.find((step) => maxSeconds / step <= 4) ?? 3600;
}

/** Width of an element, kept up to date, so the chart draws in real pixels. */
function useWidth(): [(node: HTMLDivElement | null) => void, number] {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!node) return;
    const update = () => setWidth(node.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  return [setNode, width];
}

/**
 * Column chart of the player's recent solve times. Single series in the
 * accent hue; clean solves carry a check mark on the cap so the state is
 * never colour-alone. Columns grow from the baseline on first paint.
 */
export function SolveChart({ history, limit = 10 }: SolveChartProps) {
  const id = useId();
  const { t, tn, locale } = useI18n();
  const [hover, setHover] = useState<number | null>(null);
  const [wrapRef, width] = useWidth();

  const games = useMemo(() => [...history].slice(0, limit).reverse(), [history, limit]);

  if (games.length === 0) {
    return (
      <div className={styles.card}>
        <Heading count={0} />
        <p className={styles.empty}>
          <IconSparkle size={16} /> {t('chart.empty')}
        </p>
      </div>
    );
  }

  const maxMs = Math.max(...games.map((game) => game.timeMs), 1);
  const step = tickStep(maxMs / 1000);
  const top = Math.ceil(maxMs / 1000 / step) * step * 1000;
  const ticks = Array.from({ length: Math.round(top / 1000 / step) + 1 }, (_, i) => i * step * 1000);

  const plotWidth = Math.max(width - PAD.left - PAD.right, 0);
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const band = plotWidth / games.length;
  const barWidth = Math.min(MAX_BAR, band * 0.6);
  const y = (ms: number) => PAD.top + plotHeight - (ms / top) * plotHeight;
  const bestIndex = games.reduce((best, game, i) => (game.timeMs < games[best].timeMs ? i : best), 0);
  // Skip every other date label when the bands get narrow (phones).
  const labelEvery = band < 46 ? 2 : 1;
  const hovered = hover === null ? null : games[hover];

  return (
    <div className={styles.card}>
      <Heading count={games.length} />
      <div className={styles.plotWrap} ref={wrapRef}>
        {width > 0 && (
          <svg
            className={styles.svg}
            width={width}
            height={HEIGHT}
            viewBox={`0 0 ${width} ${HEIGHT}`}
            role="img"
            aria-labelledby={`${id}-title`}
            onMouseLeave={() => setHover(null)}
          >
            <title id={`${id}-title`}>{t('chart.aria', { games: tn('count.game', games.length) })}</title>

            {ticks.map((tick) => (
              <g key={tick}>
                <line className={styles.grid} x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} />
                <text className={styles.tick} x={PAD.left - 8} y={y(tick)} textAnchor="end" dominantBaseline="middle">
                  {formatDuration(tick)}
                </text>
              </g>
            ))}

            {games.map((game, i) => {
              const cx = PAD.left + band * i + band / 2;
              const barY = y(game.timeMs);
              const barH = PAD.top + plotHeight - barY;
              const clean = isClean(game);
              const isBest = i === bestIndex;
              // Every other label, anchored on the newest game so the last date is always shown.
              const showLabel = labelEvery === 1 || i % 2 === (games.length - 1) % 2;
              return (
                <g key={game.id} className={`${styles.column} ${hover === i ? styles.columnHover : ''}`} style={{ '--i': i } as React.CSSProperties}>
                  <rect className={styles.bar} x={cx - barWidth / 2} y={barY} width={barWidth} height={Math.max(barH, 2)} rx={4} ry={4} />
                  {/* Square the baseline end of the rounded rect */}
                  {barH > 4 && <rect className={styles.bar} x={cx - barWidth / 2} y={barY + barH - 4} width={barWidth} height={4} />}
                  {clean && (
                    <g className={styles.check} transform={`translate(${cx - 7}, ${barY - 18})`}>
                      <circle cx={7} cy={7} r={7} className={styles.checkRing} />
                      <IconCheck size={9} x={2.5} y={2.5} className={styles.checkIcon} />
                    </g>
                  )}
                  {isBest && (
                    <text className={styles.label} x={cx} y={barY - (clean ? 24 : 8)} textAnchor="middle">
                      {t('chart.best', { time: formatDuration(game.timeMs) })}
                    </text>
                  )}
                  {showLabel && (
                    <text className={styles.axis} x={cx} y={HEIGHT - 8} textAnchor="middle">
                      {shortDate(game.solvedAt, locale)}
                    </text>
                  )}
                  {/* Hit target wider than the mark, drawn last so it is on top */}
                  <rect
                    className={styles.hit}
                    x={cx - band / 2}
                    y={PAD.top}
                    width={band}
                    height={plotHeight}
                    onMouseEnter={() => setHover(i)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    tabIndex={0}
                    aria-label={`${game.puzzleTitle}, ${formatDuration(game.timeMs)}${clean ? `, ${t('chart.cleanSolve')}` : ''}`}
                  />
                </g>
              );
            })}
            <line className={styles.baseline} x1={PAD.left} x2={width - PAD.right} y1={PAD.top + plotHeight} y2={PAD.top + plotHeight} />
          </svg>
        )}

        {hovered && hover !== null && (
          <div className={styles.tooltip} role="status" style={{ left: PAD.left + band * hover + band / 2, top: y(hovered.timeMs) }}>
            <span className={styles.tooltipTitle}>{hovered.puzzleTitle}</span>
            <span className={styles.tooltipValue}>{formatDuration(hovered.timeMs)}</span>
            <span className={styles.tooltipMeta}>
              {isClean(hovered) ? t('chart.cleanSolve') : `${tn('count.check', hovered.checks)} · ${tn('count.reveal', hovered.reveals)}`}
              {' · '}
              {shortDate(hovered.solvedAt, locale)}
            </span>
          </div>
        )}
      </div>
      <p className={styles.legend}>
        <span className={styles.legendCheck}>
          <IconCheck size={10} />
        </span>{' '}
        {t('chart.legend')}
      </p>
    </div>
  );
}

function Heading({ count }: { count: number }) {
  const { t, tn } = useI18n();
  return (
    <div className={styles.heading}>
      <h2 className={styles.title}>{t('chart.title')}</h2>
      <span className={styles.subtitle}>{count > 0 ? t('chart.subtitle', { games: tn('count.game', count) }) : t('chart.nothing')}</span>
    </div>
  );
}

function shortDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}
