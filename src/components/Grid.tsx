import { useEffect, useMemo, type CSSProperties, type RefObject } from 'react';
import { useI18n } from '../i18n';
import { wordAt } from '../model/navigation';
import type { Cell, Puzzle, SeparatorKind, WordId } from '../model/types';
import type { PuzzleState } from '../state/reducer';
import type { Derived } from '../state/selectors';
import { formatDuration } from '../utils/time';
import { IconPlay } from './Icons';
import styles from './Grid.module.css';

export interface Pulse {
  seq: number;
  cells: number[];
}

interface GridProps {
  puzzle: Puzzle;
  state: PuzzleState;
  derived: Derived;
  /** Word ids to draw as solved (may be empty when the player turned that feedback off). */
  solvedWords: Set<WordId>;
  paused: boolean;
  elapsedMs: number;
  pulse: Pulse | null;
  inputRef: RefObject<HTMLInputElement | null>;
  /** Touch devices use our own keyboard, so the system one must stay hidden. */
  virtualKeyboard?: boolean;
  onSelect: (cell: number) => void;
  onResume: () => void;
  onLetter: (letter: string) => void;
  onBackspace: () => void;
}

type Edges = { right?: SeparatorKind; bottom?: SeparatorKind };

export function Grid({
  puzzle,
  state,
  derived,
  solvedWords,
  paused,
  elapsedMs,
  pulse,
  inputRef,
  virtualKeyboard = false,
  onSelect,
  onResume,
  onLetter,
  onBackspace,
}: GridProps) {
  const { t, wordLabel } = useI18n();
  const rows = useMemo(() => {
    const out: Cell[][] = [];
    for (let r = 0; r < puzzle.height; r++) out.push(puzzle.cells.slice(r * puzzle.width, (r + 1) * puzzle.width));
    return out;
  }, [puzzle]);

  // Word breaks from enumerations, e.g. (5,2): a bar after the fifth letter.
  const edges = useMemo(() => {
    const map = new Map<number, Edges>();
    for (const word of puzzle.words) {
      for (const sep of word.separators) {
        const cellId = word.cells[sep.after];
        const entry = map.get(cellId) ?? {};
        if (word.direction === 'across') entry.right = sep.kind;
        else entry.bottom = sep.kind;
        map.set(cellId, entry);
      }
    }
    return map;
  }, [puzzle]);

  const inCurrentWord = useMemo(() => new Set(derived.currentWord?.cells ?? []), [derived.currentWord]);
  const pulseIndex = useMemo(() => new Map((pulse?.cells ?? []).map((id, i) => [id, i])), [pulse]);

  // Virtual keyboards on Android report "Unidentified" keys, so letters and
  // deletions arrive here through beforeinput instead of keydown.
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const onBeforeInput = (event: InputEvent) => {
      event.preventDefault();
      if (event.inputType === 'deleteContentBackward') onBackspace();
      else if (event.inputType.startsWith('insert') && event.data) {
        const letter = event.data.trim().slice(-1);
        if (letter) onLetter(letter);
      }
    };
    input.addEventListener('beforeinput', onBeforeInput);
    return () => input.removeEventListener('beforeinput', onBeforeInput);
  }, [inputRef, onLetter, onBackspace]);

  const selectedCell = puzzle.cells[state.selected];
  const currentWord = derived.currentWord;
  const inputLabel = (() => {
    const position = currentWord ? currentWord.cells.indexOf(state.selected) + 1 : 0;
    const where = currentWord
      ? `${wordLabel(currentWord)}: ${currentWord.clue} ${currentWord.enumeration}. ${t('cell.letterOf', { position, total: currentWord.cells.length })}`
      : `${t('cell.position', { row: selectedCell.row + 1, col: selectedCell.col + 1 })}.`;
    const letter = state.letters[state.selected];
    return `${where} ${letter ? t('cell.contains', { letter }) : t('cell.isEmpty')}`;
  })();

  const gridStyle = { '--cols': puzzle.width, '--rows': puzzle.height } as CSSProperties;
  const inputStyle = { '--x': selectedCell.col, '--y': selectedCell.row } as CSSProperties;

  return (
    <div className={`${styles.wrap} ${paused ? styles.paused : ''} ${state.solvedAt ? styles.solved : ''}`}>
      <div className={styles.grid} style={gridStyle} role="grid" aria-label={t('game.grid', { title: puzzle.title })}>
        {rows.map((row, r) => (
          <div key={r} className={styles.row} role="row">
            {row.map((cell) => {
              if (cell.block) {
                return <div key={cell.id} className={`${styles.cell} ${styles.block}`} role="gridcell" aria-hidden="true" />;
              }
              const letter = state.letters[cell.id];
              const mark = state.marks[cell.id];
              const isSelected = cell.id === state.selected;
              const edge = edges.get(cell.id);
              const isSolvedWord =
                (cell.across !== null && solvedWords.has(cell.across)) || (cell.down !== null && solvedWords.has(cell.down));
              const pulseAt = pulseIndex.get(cell.id);
              const classes = [
                styles.cell,
                isSelected && styles.selected,
                !isSelected && inCurrentWord.has(cell.id) && styles.inWord,
                mark === 'wrong' && styles.wrong,
                mark === 'revealed' && styles.revealed,
                state.pencils[cell.id] && styles.pencil,
                isSolvedWord && styles.correct,
                edge?.right === 'space' && styles.barRight,
                edge?.right === 'hyphen' && styles.dashRight,
                edge?.bottom === 'space' && styles.barBottom,
                edge?.bottom === 'hyphen' && styles.dashBottom,
                pulseAt !== undefined && styles.pulse,
              ]
                .filter(Boolean)
                .join(' ');
              const across = wordAt(puzzle, cell.id, 'across');
              const down = wordAt(puzzle, cell.id, 'down');
              const label = [
                t('cell.position', { row: cell.row + 1, col: cell.col + 1 }),
                across && wordLabel(across),
                down && wordLabel(down),
                letter ? letter : t('cell.empty'),
                mark === 'wrong' ? t('cell.wrong') : mark === 'revealed' ? t('cell.revealed') : null,
                state.pencils[cell.id] ? t('cell.pencil') : null,
              ]
                .filter(Boolean)
                .join(', ');
              return (
                <div
                  // Re-mounting the cell restarts the celebration animation.
                  key={pulseAt !== undefined ? `${cell.id}:${pulse?.seq}` : cell.id}
                  className={classes}
                  role="gridcell"
                  aria-selected={isSelected}
                  aria-label={label}
                  style={pulseAt !== undefined ? ({ '--i': pulseAt } as CSSProperties) : undefined}
                  onPointerDown={(event) => {
                    event.preventDefault(); // keep focus management in our hands
                    onSelect(cell.id);
                  }}
                >
                  {cell.number !== null && <span className={styles.number}>{cell.number}</span>}
                  {letter && <span className={styles.letter}>{letter}</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <input
        ref={inputRef}
        className={styles.input}
        style={inputStyle}
        type="text"
        defaultValue=" "
        aria-label={inputLabel}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="characters"
        spellCheck={false}
        enterKeyHint="next"
        inputMode={virtualKeyboard ? "none" : "text"}
        readOnly={virtualKeyboard}
        tabIndex={0}
      />

      {paused && (
        <div className={styles.overlay}>
          <div className={styles.overlayCard}>
            <p className={styles.overlayTitle}>{t('game.paused')}</p>
            <p className={styles.overlayTime}>{formatDuration(elapsedMs)}</p>
            <button type="button" className="btn btn-primary" onClick={onResume} autoFocus>
              <IconPlay size={14} /> {t('game.resume')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
