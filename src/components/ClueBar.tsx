import { useI18n } from '../i18n';
import type { Word } from '../model/types';
import { IconCheck, IconChevronLeft, IconChevronRight, IconSwap } from './Icons';
import styles from './ClueBar.module.css';

interface ClueBarProps {
  word: Word | null;
  solved: boolean;
  canSwitch: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onSwitch: () => void;
}

/** The clue for the word being worked on: always visible, right above the grid. */
export function ClueBar({ word, solved, canSwitch, onPrevious, onNext, onSwitch }: ClueBarProps) {
  const { t, wordLabel } = useI18n();
  return (
    <div className={`${styles.bar} ${solved ? styles.solved : ''}`}>
      <button type="button" className={`btn btn-ghost btn-icon ${styles.nav}`} onClick={onPrevious} aria-label={t('game.previousClue')} title={t('game.previousClueHint')}>
        <IconChevronLeft size={18} />
      </button>

      <div className={styles.body}>
        {word ? (
          <>
            <div className={styles.meta}>
              <span className={styles.label}>{wordLabel(word)}</span>
              <span className={styles.enumeration}>{word.enumeration}</span>
              {solved && (
                <span className={styles.solvedTag}>
                  <IconCheck size={12} /> {t('game.solvedTag')}
                </span>
              )}
            </div>
            <p className={styles.clue}>{word.clue}</p>
          </>
        ) : (
          <p className={styles.clue}>{t('game.selectToStart')}</p>
        )}
      </div>

      <button
        type="button"
        className={`btn btn-ghost btn-icon ${styles.nav}`}
        onClick={onSwitch}
        disabled={!canSwitch}
        aria-label={word ? t('dir.switchTo', { direction: t(word.direction === 'across' ? 'dir.down' : 'dir.across').toLowerCase() }) : t('dir.switch')}
        title={t('dir.switchShortcut')}
      >
        <IconSwap size={16} />
      </button>
      <button type="button" className={`btn btn-ghost btn-icon ${styles.nav}`} onClick={onNext} aria-label={t('game.nextClue')} title={t('game.nextClueHint')}>
        <IconChevronRight size={18} />
      </button>
    </div>
  );
}
