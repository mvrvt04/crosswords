import type { CellId, Direction, Puzzle, Word, WordId } from './types';

/** The player's current letters, one slot per cell (null = empty or block). */
export type Letters = (string | null)[];

export const otherDirection = (direction: Direction): Direction =>
  direction === 'across' ? 'down' : 'across';

export const cellIdAt = (puzzle: Puzzle, row: number, col: number): CellId => row * puzzle.width + col;

export function wordAt(puzzle: Puzzle, cellId: CellId, direction: Direction): Word | null {
  const id = puzzle.cells[cellId][direction];
  return id ? puzzle.wordsById[id] : null;
}

/** Keep `direction` if the cell has a word that way, otherwise fall back to the other one. */
export function preferredDirection(puzzle: Puzzle, cellId: CellId, direction: Direction): Direction {
  const cell = puzzle.cells[cellId];
  if (cell[direction]) return direction;
  return cell[otherDirection(direction)] ? otherDirection(direction) : direction;
}

/** Next non-block cell from `cellId` in the (dr, dc) direction, or null at the edge. */
export function step(puzzle: Puzzle, cellId: CellId, dr: number, dc: number): CellId | null {
  let { row, col } = puzzle.cells[cellId];
  for (;;) {
    row += dr;
    col += dc;
    if (row < 0 || row >= puzzle.height || col < 0 || col >= puzzle.width) return null;
    const cell = puzzle.cells[cellIdAt(puzzle, row, col)];
    if (!cell.block) return cell.id;
  }
}

/** All words in clue order: every across word, then every down word. */
export const allWordIds = (puzzle: Puzzle): WordId[] => [...puzzle.order.across, ...puzzle.order.down];

export function nextWordId(puzzle: Puzzle, wordId: WordId, delta: 1 | -1): WordId {
  const ids = allWordIds(puzzle);
  const index = ids.indexOf(wordId);
  return ids[(index + delta + ids.length) % ids.length];
}

export function firstEmptyCell(word: Word, letters: Letters): CellId | null {
  return word.cells.find((id) => !letters[id]) ?? null;
}

/** Where to land when a word is selected: its first empty cell, or its start. */
export function firstTarget(word: Word, letters: Letters): CellId {
  return firstEmptyCell(word, letters) ?? word.cells[0];
}

export function nextEmptyInWord(word: Word, letters: Letters, afterCell: CellId): CellId | null {
  const index = word.cells.indexOf(afterCell);
  return word.cells.slice(index + 1).find((id) => !letters[id]) ?? null;
}

export const isWordFilled = (word: Word, letters: Letters): boolean =>
  word.cells.every((id) => Boolean(letters[id]));

export const isWordCorrect = (puzzle: Puzzle, word: Word, letters: Letters): boolean =>
  word.cells.every((id) => letters[id] === puzzle.cells[id].solution);

export function solvedWordIds(puzzle: Puzzle, letters: Letters): Set<WordId> {
  const solved = new Set<WordId>();
  for (const word of puzzle.words) {
    if (isWordCorrect(puzzle, word, letters)) solved.add(word.id);
  }
  return solved;
}

export const isPuzzleFilled = (puzzle: Puzzle, letters: Letters): boolean =>
  puzzle.cells.every((cell) => cell.block || Boolean(letters[cell.id]));

export const isPuzzleSolved = (puzzle: Puzzle, letters: Letters): boolean =>
  puzzle.cells.every((cell) => cell.block || letters[cell.id] === cell.solution);

export const wordLabel = (word: Word): string =>
  `${word.number} ${word.direction === 'across' ? 'Across' : 'Down'}`;
