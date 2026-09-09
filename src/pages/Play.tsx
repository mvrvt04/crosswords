import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { BrandMark } from '../components/BrandMark';
import { Game, type SolveResult } from '../game/Game';
import { describeError, useI18n } from '../i18n';
import { parseCrossword } from '../model/parse';
import type { Puzzle } from '../model/types';
import { useApi } from '../services/api';
import { useSession } from '../services/session';
import styles from './Play.module.css';

/** Loads one puzzle by id and hands it to the game. */
export function Play() {
  const { id = '' } = useParams();
  const api = useApi();
  const i18n = useI18n();
  const { t } = i18n;
  const { token } = useSession();
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPuzzle(null);
    setError(null);
    api
      .getPuzzle(id)
      .then((record) => {
        if (!cancelled) setPuzzle(parseCrossword(record.data));
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(describeError(i18n, caught));
      });
    return () => {
      cancelled = true;
    };
  }, [api, id, i18n]);

  const onSolved = useCallback(
    (result: SolveResult) => {
      if (!token) return;
      // Fire and forget: a failed save must never interrupt the celebration.
      api.recordGame(token, { puzzleId: id, ...result }).catch(() => undefined);
    },
    [api, token, id],
  );

  if (error) {
    return (
      <div className={styles.center}>
        <BrandMark size={40} />
        <h1 className={styles.title}>{t('play.failedTitle')}</h1>
        <p className={styles.text}>{error}</p>
        <Link to="/" className="btn btn-primary">
          {t('nav.backToDashboard')}
        </Link>
      </div>
    );
  }

  if (!puzzle) {
    return (
      <div className={styles.center} aria-busy="true">
        <BrandMark size={40} />
        <p className={styles.text}>{t('play.loading')}</p>
      </div>
    );
  }

  return <Game key={id} puzzle={puzzle} puzzleId={id} onSolved={onSolved} />;
}
