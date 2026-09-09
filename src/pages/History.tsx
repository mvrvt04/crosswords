import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { IconArrowLeft, IconSparkle } from '../components/Icons';
import { TopBar } from '../components/TopBar';
import { describeError, useI18n } from '../i18n';
import { useApi } from '../services/api';
import { useSession } from '../services/session';
import { isClean } from '../services/stats';
import type { GameRecord, PlayerStats } from '../services/types';
import { formatDuration } from '../utils/time';
import { formatWhen } from './Home';
import styles from './History.module.css';
import settingsStyles from './Settings.module.css';
import shared from './pages.module.css';

/** Every solved game, newest first, grouped by month. */
export function History() {
  const api = useApi();
  const i18n = useI18n();
  const { t, tn, locale } = i18n;
  const { player, token, signOut } = useSession();
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = `${t('history.title')} · ${t('app.name')}`;
  }, [t]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api
      .getMyStats(token)
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        if ((caught as { status?: number }).status === 401) {
          void signOut();
          return;
        }
        setError(describeError(i18n, caught));
      });
    return () => {
      cancelled = true;
    };
  }, [api, token, i18n, signOut]);

  /** Games grouped by calendar month, in the order they already come (newest first). */
  const groups = useMemo(() => {
    const byMonth = new Map<string, GameRecord[]>();
    for (const game of stats?.history ?? []) {
      const date = new Date(game.solvedAt);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const list = byMonth.get(key) ?? [];
      list.push(game);
      byMonth.set(key, list);
    }
    const now = new Date();
    return [...byMonth.values()].map((games) => {
      const date = new Date(games[0].solvedAt);
      const label = date.toLocaleDateString(locale, { month: 'long', year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
      return { label: label.charAt(0).toUpperCase() + label.slice(1), games };
    });
  }, [stats, locale]);

  if (!player) return null;

  return (
    <div className={shared.page}>
      <TopBar
        user={{ name: player.name, onSignOut: () => void signOut() }}
        right={
          <Link to="/" className={`btn btn-ghost ${settingsStyles.back}`} aria-label={t('nav.backToDashboard')} title={t('nav.backToDashboard')}>
            <IconArrowLeft size={15} /> <span className={settingsStyles.backLabel}>{t('nav.backToDashboard')}</span>
          </Link>
        }
      />
      <main className={`${shared.content} ${styles.main}`}>
        <header className={styles.header}>
          <h1 className={settingsStyles.title}>{t('history.title')}</h1>
          {stats && stats.history.length > 0 && (
            <p className={styles.summary}>
              {tn('count.game', stats.history.length)}
              {stats.bestMs !== null && <> · {t('history.best', { time: formatDuration(stats.bestMs) })}</>}
              {' · '}
              {t('history.clean', { count: stats.cleanSolves })}
            </p>
          )}
        </header>

        {error && (
          <p className={shared.error} role="alert">
            {error}
          </p>
        )}

        {stats && stats.history.length === 0 && (
          <div className={styles.empty}>
            <IconSparkle size={18} />
            <p>{t('home.historyEmpty')}</p>
            <Link to="/" className="btn btn-primary">
              {t('nav.backToDashboard')}
            </Link>
          </div>
        )}

        {groups.map((group, index) => (
          <section key={group.label} className={styles.group} style={{ animationDelay: `${Math.min(index, 6) * 50}ms` }} aria-labelledby={`month-${index}`}>
            <h2 id={`month-${index}`} className={shared.h2}>
              {group.label}
            </h2>
            <ol className={styles.list}>
              {group.games.map((game) => (
                <HistoryRow key={game.id} game={game} />
              ))}
            </ol>
          </section>
        ))}
      </main>
    </div>
  );
}

function HistoryRow({ game }: { game: GameRecord }) {
  const i18n = useI18n();
  const { t, tn } = i18n;
  const clean = isClean(game);
  return (
    <li className={styles.row}>
      <div className={styles.text}>
        <span className={styles.title}>{game.puzzleTitle}</span>
        <span className={styles.meta}>{formatWhen(i18n, game.solvedAt)}</span>
      </div>
      <div className={styles.badges}>
        {clean ? (
          <span className={`${styles.badge} ${styles.badgeOk}`}>{t('home.badge.clean')}</span>
        ) : (
          <span className={styles.badge}>
            {tn('count.check', game.checks)} · {tn('count.reveal', game.reveals)}
          </span>
        )}
        <span className={styles.time}>{formatDuration(game.timeMs)}</span>
      </div>
    </li>
  );
}
