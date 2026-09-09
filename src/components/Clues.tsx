import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import type { Direction, Puzzle, WordId } from '../model/types';
import { IconCheck } from './Icons';
import styles from './Clues.module.css';

interface CluesProps {
  puzzle: Puzzle;
  direction: Direction;
  currentWordId: WordId | null;
  crossingWordId: WordId | null;
  solvedWords: Set<WordId>;
  onSelect: (wordId: WordId) => void;
}

const DIRECTIONS: Direction[] = ['across', 'down'];

/** Both clue lists side by side; on narrow screens they become two tabs. */
export function Clues({ puzzle, direction, currentWordId, crossingWordId, solvedWords, onSelect }: CluesProps) {
  const { t, directionHeading } = useI18n();
  const [tab, setTab] = useState<Direction>(direction);
  // On mobile the tab follows the direction the player is working in.
  useEffect(() => setTab(direction), [direction]);

  return (
    <div className={styles.root}>
      <div className={styles.tabs} role="tablist" aria-label={t('game.clueLists')}>
        {DIRECTIONS.map((dir) => (
          <button
            key={dir}
            type="button"
            role="tab"
            id={`tab-${dir}`}
            aria-selected={tab === dir}
            aria-controls={`clues-${dir}`}
            className={`${styles.tab} ${tab === dir ? styles.tabActive : ''}`}
            onClick={() => setTab(dir)}
          >
            {directionHeading(dir)}
            <span className={styles.tabCount}>
              {puzzle.order[dir].filter((id) => solvedWords.has(id)).length}/{puzzle.order[dir].length}
            </span>
          </button>
        ))}
      </div>

      {DIRECTIONS.map((dir) => (
        <ClueSection
          key={dir}
          direction={dir}
          puzzle={puzzle}
          active={tab === dir}
          currentWordId={currentWordId}
          crossingWordId={crossingWordId}
          solvedWords={solvedWords}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

interface SectionProps extends Omit<CluesProps, 'direction'> {
  direction: Direction;
  active: boolean;
}

function ClueSection({ puzzle, direction, active, currentWordId, crossingWordId, solvedWords, onSelect }: SectionProps) {
  const { t, directionHeading } = useI18n();
  const listRef = useRef<HTMLOListElement>(null);

  // Keep the current clue in view inside the list, without ever scrolling the page.
  useEffect(() => {
    const list = listRef.current;
    const item = list?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!list || !item || list.scrollHeight <= list.clientHeight) return;
    const listRect = list.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const padding = 12;
    let delta = 0;
    if (itemRect.top < listRect.top + padding) delta = itemRect.top - listRect.top - padding;
    else if (itemRect.bottom > listRect.bottom - padding) delta = itemRect.bottom - listRect.bottom + padding;
    if (delta !== 0) list.scrollBy({ top: delta, behavior: 'smooth' });
  }, [currentWordId]);

  return (
    <section
      id={`clues-${direction}`}
      role="tabpanel"
      aria-labelledby={`tab-${direction}`}
      className={`${styles.section} ${active ? styles.sectionActive : ''}`}
    >
      <h2 className={styles.heading}>{directionHeading(direction)}</h2>
      <ol className={styles.list} ref={listRef}>
        {puzzle.order[direction].map((id) => {
          const word = puzzle.wordsById[id];
          const isCurrent = id === currentWordId;
          const isCrossing = id === crossingWordId;
          const isSolved = solvedWords.has(id);
          return (
            <li key={id}>
              <button
                type="button"
                className={[styles.item, isCurrent && styles.current, isCrossing && styles.crossing, isSolved && styles.solved].filter(Boolean).join(' ')}
                aria-current={isCurrent ? 'true' : undefined}
                onClick={() => onSelect(id)}
              >
                <span className={styles.number}>{word.number}</span>
                <span className={styles.text}>
                  {word.clue} <span className={styles.enumeration}>{word.enumeration}</span>
                </span>
                {isSolved && (
                  <span className={styles.tick} aria-label={t('game.solvedAria')}>
                    <IconCheck size={14} />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
