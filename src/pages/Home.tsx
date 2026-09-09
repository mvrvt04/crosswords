import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { IconArrowRight, IconCheck, IconPlay } from '../components/Icons';
import { SolveChart } from '../components/SolveChart';
import { StatTile } from '../components/StatTile';
import { Toast } from '../components/Toast';
import { TopBar } from '../components/TopBar';
import { useToast } from '../hooks/useToast';
import { describeError, useI18n, type I18n } from '../i18n';
import { useApi } from '../services/api';
import { useSession } from '../services/session';
import type { PlayerStats, PuzzleSummary } from '../services/types';
import { loadSession, type SessionProgress } from '../state/storage';
import { formatDuration } from '../utils/time';
import styles from './Home.module.css';
import loginStyles from './Login.module.css';
import shared from './pages.module.css';

interface InProgress {
  puzzle: PuzzleSummary;
  progress: SessionProgress | undefined;
  elapsedMs: number;
}

export function Home() {
  const api = useApi();
  const i18n = useI18n();
  const { t, lang } = i18n;
  const { player, token, signOut } = useSession();
  const { toast, dismiss } = useToast();

  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [puzzles, setPuzzles] = useState<PuzzleSummary[] | null>(null);
  const [daily, setDaily] = useState<PuzzleSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = t('app.name');
  }, [t]);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const [playerStats, list, today] = await Promise.all([api.getMyStats(token), api.listPuzzles(lang), api.dailyPuzzle(lang).catch(() => null)]);
      setStats(playerStats);
      setPuzzles(list);
      setDaily(today);
    } catch (caught) {
      if ((caught as { status?: number }).status === 401) {
        void signOut();
        return;
      }
      setError(describeError(i18n, caught));
    }
  }, [api, token, lang, signOut, i18n]);

  useEffect(() => {
    void load();
  }, [load]);

  const inProgress = useMemo<InProgress | null>(() => {
    if (!puzzles) return null;
    for (const puzzle of puzzles) {
      const session = loadSession(`crossword:${puzzle.id}`);
      if (session && session.game.solvedAt === null && session.game.letters.some(Boolean)) {
        return { puzzle, progress: session.progress, elapsedMs: session.elapsedMs };
      }
    }
    return null;
  }, [puzzles]);

  /** Best time per puzzle, for "solved" marks on the daily card and the list. */
  const solvedBest = useMemo(() => {
    const best = new Map<string, number>();
    for (const game of stats?.history ?? []) {
      const current = best.get(game.puzzleId);
      if (current === undefined || game.timeMs < current) best.set(game.puzzleId, game.timeMs);
    }
    return best;
  }, [stats]);

  if (!player) return null;
  const dailyInProgress = inProgress && daily && inProgress.puzzle.id === daily.id ? inProgress : null;
  const dailyBest = daily ? solvedBest.get(daily.id) : undefined;

  return (
    <div className={shared.page}>
      <TopBar user={{ name: player.name, onSignOut: () => void signOut() }} />

      <main className={shared.content}>
        <section className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>{greeting(i18n)}</p>
            <h1 className={styles.name}>{player.name}</h1>
          </div>

          <div className={styles.daily}>
            <div className={`${loginStyles.backdrop} ${styles.dailyBackdrop}`} aria-hidden="true">
              <div className={`${loginStyles.pattern} ${styles.dailyPattern}`} />
            </div>
            <span className={styles.dailyLabel}>{t('home.daily')}</span>
            {daily ? (
              <>
                <span className={styles.dailyTitle}>{daily.title}</span>
                <span className={styles.dailyMeta}>
                  {t('home.words', { width: daily.width, height: daily.height, count: daily.wordCount })}
                  {dailyInProgress?.progress && (
                    <>
                      {' · '}
                      {t('home.wordsProgress', { solved: dailyInProgress.progress.solvedWords, total: dailyInProgress.progress.totalWords })}
                    </>
                  )}
                  {dailyBest !== undefined && !dailyInProgress && (
                    <>
                      {' · '}
                      <IconCheck size={12} /> {t('home.solvedIn', { time: formatDuration(dailyBest) })}
                    </>
                  )}
                </span>
                <Link to={`/play/${daily.id}`} className={`btn btn-primary ${styles.playButton}`}>
                  <IconPlay size={14} /> {dailyInProgress ? t('home.continue') : dailyBest !== undefined ? t('home.playAgain') : t('home.playToday')}
                </Link>
              </>
            ) : (
              <span className={styles.dailyMeta}>{puzzles === null ? '…' : t('home.libraryEmpty', { language: i18n.languageName(lang) })}</span>
            )}
          </div>
        </section>

        {error && (
          <div className={shared.error} role="alert">
            {error}{' '}
            <button type="button" className={shared.inlineLink} onClick={load}>
              {t('error.tryAgain')}
            </button>
          </div>
        )}

        {inProgress && inProgress.puzzle.id !== daily?.id && (
          <Link to={`/play/${inProgress.puzzle.id}`} className={styles.continue}>
            <span className={styles.continueLabel}>
              <IconPlay size={12} /> {t('home.continue')}
            </span>
            <span className={styles.continueTitle}>{inProgress.puzzle.title}</span>
            <span className={styles.continueMeta}>
              {inProgress.progress ? t('home.wordsProgress', { solved: inProgress.progress.solvedWords, total: inProgress.progress.totalWords }) : t('home.inProgress')}
              {' · '}
              {formatDuration(inProgress.elapsedMs)}
            </span>
          </Link>
        )}

        <section className={styles.stats} aria-label={t('home.stats')}>
          <StatTile label={t('home.stat.solved')} value={stats ? stats.solved : null} empty="0" tone="accent" />
          <StatTile label={t('home.stat.best')} value={stats?.bestMs ?? null} format={formatDuration} empty="–" />
          <StatTile label={t('home.stat.average')} value={stats?.averageMs ?? null} format={formatDuration} empty="–" />
          <StatTile label={t('home.stat.clean')} value={stats ? stats.cleanSolves : null} empty="0" tone="ok" hint={t('home.stat.cleanHint')} />
        </section>

        <SolveChart history={stats?.history ?? []} />

        <section className={styles.panel} aria-labelledby="library-heading">
          <h2 id="library-heading" className={shared.h2}>
            {t('home.library')}
          </h2>
          {puzzles && puzzles.length === 0 && <p className={styles.empty}>{t('home.libraryEmpty', { language: i18n.languageName(lang) })}</p>}
          {puzzles && puzzles.length > 0 && (
            <ul className={styles.library}>
              {puzzles.map((puzzle) => {
                const best = solvedBest.get(puzzle.id);
                return (
                  <li key={puzzle.id} className={styles.libraryRow}>
                    <div className={styles.libraryText}>
                      <span className={styles.libraryTitle}>
                        {puzzle.title}
                        {puzzle.id === daily?.id && <span className={styles.todayTag}>{t('home.today')}</span>}
                        {best !== undefined && (
                          <span className={styles.solvedTag}>
                            <IconCheck size={12} /> {t('home.solvedTag')} · {formatDuration(best)}
                          </span>
                        )}
                      </span>
                      <span className={styles.libraryMeta}>{t('home.words', { width: puzzle.width, height: puzzle.height, count: puzzle.wordCount })}</span>
                    </div>
                    <Link to={`/play/${puzzle.id}`} className="btn btn-ghost" aria-label={`${best !== undefined ? t('home.playAgain') : t('home.playToday')}: ${puzzle.title}`}>
                      {best !== undefined ? t('home.playAgain') : t('home.playToday')} <IconArrowRight size={14} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {api.mode === 'local' && <p className={shared.note}>{t('home.offline')}</p>}
      </main>

      <Toast toast={toast} onDismiss={dismiss} />
    </div>
  );
}

function greeting({ t }: I18n): string {
  const hour = new Date().getHours();
  if (hour < 5) return t('home.greeting.late');
  if (hour < 12) return t('home.greeting.morning');
  if (hour < 18) return t('home.greeting.afternoon');
  return t('home.greeting.evening');
}

export function formatWhen({ t, locale }: Pick<I18n, 't' | 'locale'>, iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const time = date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return t('when.today', { time });
  if (date.toDateString() === yesterday.toDateString()) return t('when.yesterday', { time });
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}
