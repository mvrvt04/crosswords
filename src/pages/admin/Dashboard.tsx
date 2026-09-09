import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router';
import { IconArrowRight, IconPin } from '../../components/Icons';
import { StatTile } from '../../components/StatTile';
import type { PuzzleLanguage } from '../../model/types';
import { formatDuration } from '../../utils/time';
import { PageHeader } from './AdminLayout';
import { languageName, useAdmin } from './context';
import styles from './Dashboard.module.css';
import shared from '../pages.module.css';

const LANGUAGES: PuzzleLanguage[] = ['en', 'it'];

export function AdminDashboard() {
  const { overview } = useAdmin();
  const todayGames = overview.activity[overview.activity.length - 1]?.games ?? 0;

  return (
    <>
      <PageHeader title="Dashboard" description="What is happening across all players and puzzles." />

      <section className={styles.tiles} aria-label="Overview">
        <StatTile label="Players" value={overview.players} tone="accent" />
        <StatTile label="Games solved" value={overview.games} hint={`${todayGames} today`} />
        <StatTile label="Puzzles" value={overview.puzzles} hint={`${overview.activePuzzles} available to play`} />
        <StatTile label="Average time" value={overview.averageMs} format={formatDuration} empty="–" />
        <StatTile label="Clean solves" value={overview.cleanRate === null ? null : overview.cleanRate * 100} format={(v) => `${Math.round(v)}%`} empty="–" tone="ok" />
      </section>

      <div className={styles.columns}>
        <section className={`${shared.card} ${styles.chartCard}`} aria-labelledby="activity-heading">
          <div className={styles.cardHeading}>
            <h2 id="activity-heading" className={styles.cardTitle}>
              Games per day
            </h2>
            <span className={styles.cardMeta}>Last 14 days</span>
          </div>
          <ActivityChart data={overview.activity} />
        </section>

        <section className={shared.card} aria-labelledby="today-heading">
          <div className={styles.cardHeading}>
            <h2 id="today-heading" className={styles.cardTitle}>
              Today's puzzles
            </h2>
            <Link to="/admin/puzzles" className={styles.cardLink}>
              Manage <IconArrowRight size={14} />
            </Link>
          </div>
          <ul className={styles.todayList}>
            {LANGUAGES.map((language) => {
              const id = overview.today[language];
              const puzzle = overview.puzzleStats.find((candidate) => candidate.id === id);
              const pinned = overview.daily[language] === id && id !== undefined;
              return (
                <li key={language} className={styles.todayRow}>
                  <span className={styles.todayLang}>{languageName(language)}</span>
                  <span className={styles.todayTitle}>{puzzle ? puzzle.title : 'No puzzle available'}</span>
                  <span className={`${styles.todayBadge} ${pinned ? styles.todayPinned : ''}`}>
                    {pinned && <IconPin size={11} />} {pinned ? 'Pinned' : 'Rotating'}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className={styles.todayHint}>Pinned puzzles stay until you unpin them; otherwise the library rotates by day.</p>
        </section>
      </div>

      <div className={styles.columns}>
        <section className={shared.card} aria-labelledby="recent-heading">
          <div className={styles.cardHeading}>
            <h2 id="recent-heading" className={styles.cardTitle}>
              Recent games
            </h2>
            <Link to="/admin/games" className={styles.cardLink}>
              See all <IconArrowRight size={14} />
            </Link>
          </div>
          {overview.recentGames.length === 0 ? (
            <p className={styles.empty}>Nobody has solved a puzzle yet.</p>
          ) : (
            <ul className={styles.feed}>
              {overview.recentGames.slice(0, 8).map((game) => (
                <li key={game.id} className={styles.feedRow}>
                  <span className={styles.feedWho}>{game.playerName}</span>
                  <span className={styles.feedWhat}>{game.puzzleTitle}</span>
                  <span className={styles.feedTime}>{formatDuration(game.timeMs)}</span>
                  <span className={styles.feedWhen}>{relative(game.solvedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={shared.card} aria-labelledby="top-heading">
          <div className={styles.cardHeading}>
            <h2 id="top-heading" className={styles.cardTitle}>
              Top solvers
            </h2>
            <Link to="/admin/players" className={styles.cardLink}>
              All players <IconArrowRight size={14} />
            </Link>
          </div>
          {overview.playerRows.length === 0 ? (
            <p className={styles.empty}>No players yet.</p>
          ) : (
            <ol className={styles.ranking}>
              {overview.playerRows.slice(0, 5).map((player, index) => (
                <li key={player.id} className={styles.rankRow}>
                  <span className={styles.rankIndex}>{index + 1}</span>
                  <span className={styles.rankName}>{player.name}</span>
                  <span className={styles.rankGames}>{player.games} solved</span>
                  <span className={styles.rankBest}>{player.bestMs === null ? '–' : formatDuration(player.bestMs)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </>
  );
}

/** "3 min ago", "yesterday", "5 Sept". */
function relative(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

// ---------------------------------------------------------------------------
// Column chart: games per day (single series, accent hue, hover tooltip)

const HEIGHT = 180;
const PAD = { top: 16, right: 8, bottom: 26, left: 30 };

function ActivityChart({ data }: { data: { date: string; games: number }[] }) {
  const id = useId();
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    if (!node) return;
    const update = () => setWidth(node.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  const max = Math.max(1, ...data.map((d) => d.games));
  const step = max <= 4 ? 1 : max <= 10 ? 2 : Math.ceil(max / 4);
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  const plotWidth = Math.max(width - PAD.left - PAD.right, 0);
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const band = plotWidth / Math.max(data.length, 1);
  const barWidth = Math.min(24, band * 0.6);
  const y = (value: number) => PAD.top + plotHeight - (value / top) * plotHeight;
  const label = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

  return (
    <div className={styles.plot} ref={setNode}>
      {width > 0 && (
        <svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} role="img" aria-labelledby={`${id}-t`} className={styles.svg} onMouseLeave={() => setHover(null)}>
          <title id={`${id}-t`}>Games solved per day over the last {data.length} days</title>
          {ticks.map((tick) => (
            <g key={tick}>
              <line className={styles.grid} x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} />
              <text className={styles.tick} x={PAD.left - 8} y={y(tick)} textAnchor="end" dominantBaseline="middle">
                {tick}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx = PAD.left + band * i + band / 2;
            const barY = y(d.games);
            const barH = PAD.top + plotHeight - barY;
            const showLabel = band >= 40 || i % 2 === (data.length - 1) % 2;
            return (
              <g key={d.date} className={`${styles.column} ${hover === i ? styles.columnHover : ''}`} style={{ '--i': i } as React.CSSProperties}>
                {d.games > 0 && (
                  <>
                    <rect className={styles.bar} x={cx - barWidth / 2} y={barY} width={barWidth} height={barH} rx={4} ry={4} />
                    {barH > 4 && <rect className={styles.bar} x={cx - barWidth / 2} y={barY + barH - 4} width={barWidth} height={4} />}
                  </>
                )}
                {showLabel && (
                  <text className={styles.axis} x={cx} y={HEIGHT - 8} textAnchor="middle">
                    {label(d.date)}
                  </text>
                )}
                <rect className={styles.hit} x={cx - band / 2} y={PAD.top} width={band} height={plotHeight} onMouseEnter={() => setHover(i)} tabIndex={0} onFocus={() => setHover(i)} onBlur={() => setHover(null)} aria-label={`${label(d.date)}: ${d.games} games`} />
              </g>
            );
          })}
          <line className={styles.baseline} x1={PAD.left} x2={width - PAD.right} y1={PAD.top + plotHeight} y2={PAD.top + plotHeight} />
        </svg>
      )}
      {hover !== null && data[hover] && (
        <div className={styles.tooltip} role="status" style={{ left: PAD.left + band * hover + band / 2, top: y(data[hover].games) }}>
          <span className={styles.tooltipValue}>{data[hover].games} {data[hover].games === 1 ? 'game' : 'games'}</span>
          <span className={styles.tooltipMeta}>{label(data[hover].date)}</span>
        </div>
      )}
    </div>
  );
}
