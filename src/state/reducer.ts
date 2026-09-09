import {
  allWordIds,
  firstEmptyCell,
  firstTarget,
  isPuzzleFilled,
  isPuzzleSolved,
  isWordCorrect,
  isWordFilled,
  nextEmptyInWord,
  otherDirection,
  preferredDirection,
  step,
  wordAt,
  type Letters,
} from '../model/navigation';
import type { CellId, Direction, Puzzle, WordId } from '../model/types';

/**
 * All game logic lives in this pure reducer so it can be unit-tested without
 * a DOM, and so every interaction (click, key, menu) goes through the same
 * small set of transitions.
 */

/** 'wrong' is set by a check and cleared as soon as the cell is edited. 'revealed' is permanent and locks the cell. */
export type Mark = 'wrong' | 'revealed';
export type Scope = 'letter' | 'word' | 'puzzle';

export interface Settings {
  /** Briefly celebrate a word the moment it is filled in correctly. */
  celebrateWords: boolean;
  /** Flag a wrong letter as soon as it is typed. Off by default: it spoils the puzzle. */
  autoCheck: boolean;
}

export type PuzzleEvent =
  | { kind: 'word-solved'; wordIds: WordId[] }
  | { kind: 'puzzle-solved' }
  | { kind: 'puzzle-filled-incorrect' }
  | { kind: 'checked'; scope: Scope; word: WordRef | null; checked: number; wrong: number }
  | { kind: 'revealed'; scope: Scope; word: WordRef | null; changed: number }
  | { kind: 'cleared'; scope: 'word' | 'puzzle'; word: WordRef | null }
  | { kind: 'undone' }
  | { kind: 'redone' };

/** Enough to name a word in feedback ("1 Across") in any language. */
export interface WordRef {
  number: number;
  direction: Direction;
}

/** What undo restores: the grid contents and where the cursor was. */
interface Snapshot {
  letters: Letters;
  marks: Record<CellId, Mark>;
  pencils: Record<CellId, true>;
  selected: CellId;
  direction: Direction;
}

export interface PuzzleState {
  letters: Letters;
  selected: CellId;
  direction: Direction;
  marks: Record<CellId, Mark>;
  /** Cells whose letter was entered in pencil mode (tentative). */
  pencils: Record<CellId, true>;
  /** Pencil mode on/off. */
  pencil: boolean;
  history: Snapshot[];
  future: Snapshot[];
  stats: { checks: number; reveals: number };
  settings: Settings;
  /** Set by the first edit (typed or revealed letter); the timer starts here, not on the first click. */
  started: boolean;
  solvedAt: number | null;
  /** One-shot feedback for the UI layer (toasts, animations). `seq` makes repeats distinguishable. */
  event: { seq: number; payload: PuzzleEvent } | null;
}

export interface SavedGame {
  letters: Letters;
  revealed: CellId[];
  pencils?: CellId[];
  stats: PuzzleState['stats'];
  settings: Settings;
  selected: CellId;
  direction: Direction;
  solvedAt: number | null;
}

export type Action =
  | { type: 'select'; cell: CellId }
  | { type: 'selectWord'; wordId: WordId }
  | { type: 'input'; letter: string; now?: number }
  | { type: 'backspace' }
  | { type: 'delete' }
  | { type: 'move'; dr: -1 | 0 | 1; dc: -1 | 0 | 1 }
  | { type: 'toggleDirection' }
  | { type: 'togglePencil' }
  | { type: 'nextWord'; delta: 1 | -1; skipFilled?: boolean }
  | { type: 'jump'; to: 'start' | 'end' }
  | { type: 'check'; scope: Scope }
  | { type: 'reveal'; scope: Scope; now?: number }
  | { type: 'clear'; scope: 'word' | 'puzzle' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'setSetting'; key: keyof Settings; value: boolean };

export const DEFAULT_SETTINGS: Settings = { celebrateWords: true, autoCheck: false };
const HISTORY_LIMIT = 200;

export function createInitialState(puzzle: Puzzle, saved?: SavedGame | null): PuzzleState {
  const firstWord = puzzle.wordsById[allWordIds(puzzle)[0]];
  const base: PuzzleState = {
    letters: puzzle.cells.map(() => null),
    selected: firstWord.cells[0],
    direction: firstWord.direction,
    marks: {},
    pencils: {},
    pencil: false,
    history: [],
    future: [],
    stats: { checks: 0, reveals: 0 },
    settings: DEFAULT_SETTINGS,
    started: false,
    solvedAt: null,
    event: null,
  };
  if (!saved || saved.letters.length !== puzzle.cells.length) return base;

  const marks: Record<CellId, Mark> = {};
  for (const id of saved.revealed) marks[id] = 'revealed';
  const pencils: Record<CellId, true> = {};
  for (const id of saved.pencils ?? []) pencils[id] = true;
  const hasProgress = saved.letters.some(Boolean);
  return {
    ...base,
    letters: saved.letters,
    marks,
    pencils,
    stats: saved.stats,
    settings: { ...DEFAULT_SETTINGS, ...saved.settings },
    selected: puzzle.cells[saved.selected] && !puzzle.cells[saved.selected].block ? saved.selected : base.selected,
    direction: saved.direction,
    started: hasProgress,
    solvedAt: saved.solvedAt,
  };
}

export function toSavedGame(state: PuzzleState): SavedGame {
  return {
    letters: state.letters,
    revealed: Object.entries(state.marks)
      .filter(([, mark]) => mark === 'revealed')
      .map(([id]) => Number(id)),
    pencils: Object.keys(state.pencils).map(Number),
    stats: state.stats,
    settings: state.settings,
    selected: state.selected,
    direction: state.direction,
    solvedAt: state.solvedAt,
  };
}

export function reduce(puzzle: Puzzle, state: PuzzleState, action: Action): PuzzleState {
  switch (action.type) {
    case 'select':
      return select(puzzle, state, action.cell);
    case 'selectWord': {
      const word = puzzle.wordsById[action.wordId];
      if (!word) return state;
      return { ...state, selected: firstTarget(word, state.letters), direction: word.direction };
    }
    case 'input':
      return input(puzzle, state, action.letter, action.now);
    case 'backspace':
      return backspace(puzzle, state);
    case 'delete':
      return remember(state, clearCells(state, [state.selected]));
    case 'move':
      return move(puzzle, state, action.dr, action.dc);
    case 'toggleDirection': {
      const other = otherDirection(state.direction);
      return puzzle.cells[state.selected][other] ? { ...state, direction: other } : state;
    }
    case 'togglePencil':
      return { ...state, pencil: !state.pencil };
    case 'nextWord':
      return nextWord(puzzle, state, action.delta, action.skipFilled ?? true);
    case 'jump': {
      const word = wordAt(puzzle, state.selected, state.direction);
      if (!word) return state;
      return { ...state, selected: action.to === 'start' ? word.cells[0] : word.cells[word.cells.length - 1] };
    }
    case 'check':
      return check(puzzle, state, action.scope);
    case 'reveal':
      return reveal(puzzle, state, action.scope, action.now);
    case 'clear':
      return clear(puzzle, state, action.scope);
    case 'undo':
      return timeTravel(state, 'undo');
    case 'redo':
      return timeTravel(state, 'redo');
    case 'setSetting':
      return { ...state, settings: { ...state.settings, [action.key]: action.value } };
  }
}

// ---------------------------------------------------------------------------
// Selection & movement

function select(puzzle: Puzzle, state: PuzzleState, cell: CellId): PuzzleState {
  if (puzzle.cells[cell].block) return state;
  if (cell === state.selected) {
    // Clicking the selected cell again flips the direction, like most crossword apps.
    return reduce(puzzle, state, { type: 'toggleDirection' });
  }
  return { ...state, selected: cell, direction: preferredDirection(puzzle, cell, state.direction) };
}

function move(puzzle: Puzzle, state: PuzzleState, dr: number, dc: number): PuzzleState {
  const axis: Direction = dr !== 0 ? 'down' : 'across';
  // An arrow perpendicular to the current direction first switches direction
  // without moving; the next press moves. This mirrors the convention players
  // know from the most common crossword apps.
  if (axis !== state.direction && puzzle.cells[state.selected][axis]) {
    return { ...state, direction: axis };
  }
  const target = step(puzzle, state.selected, dr, dc);
  if (target === null) return state;
  return { ...state, selected: target, direction: preferredDirection(puzzle, target, axis) };
}

function nextWord(puzzle: Puzzle, state: PuzzleState, delta: 1 | -1, skipFilled: boolean): PuzzleState {
  const current = wordAt(puzzle, state.selected, state.direction);
  const ids = allWordIds(puzzle);
  const start = current ? ids.indexOf(current.id) : 0;
  const n = ids.length;

  // Tab prefers the next word that still has empty cells (falling back to
  // plain cycling); the clue-bar arrows browse every clue in order.
  for (let k = 1; skipFilled && k <= n; k++) {
    const word = puzzle.wordsById[ids[(start + k * delta + n * k) % n]];
    if (!isWordFilled(word, state.letters)) {
      return { ...state, selected: firstTarget(word, state.letters), direction: word.direction };
    }
  }
  const word = puzzle.wordsById[ids[(start + delta + n) % n]];
  return { ...state, selected: word.cells[0], direction: word.direction };
}

/** After typing, where should the cursor go next? */
function advance(puzzle: Puzzle, state: PuzzleState): Pick<PuzzleState, 'selected' | 'direction'> {
  const { selected, direction, letters } = state;
  const word = wordAt(puzzle, selected, direction);
  if (!word) return { selected, direction };

  const nextEmpty = nextEmptyInWord(word, letters, selected) ?? firstEmptyCell(word, letters);
  if (nextEmpty !== null) return { selected: nextEmpty, direction };

  // The word is full: continue with the next word that still needs letters.
  const ids = allWordIds(puzzle);
  const index = ids.indexOf(word.id);
  for (let k = 1; k < ids.length; k++) {
    const candidate = puzzle.wordsById[ids[(index + k) % ids.length]];
    const empty = firstEmptyCell(candidate, letters);
    if (empty !== null) return { selected: empty, direction: candidate.direction };
  }

  // Everything is filled: just step along the word, or stay at its end.
  const position = word.cells.indexOf(selected);
  return { selected: word.cells[Math.min(position + 1, word.cells.length - 1)], direction };
}

// ---------------------------------------------------------------------------
// Editing

function input(puzzle: Puzzle, state: PuzzleState, rawLetter: string, now = Date.now()): PuzzleState {
  const letter = rawLetter.toUpperCase();
  if (!/^[A-Z]$/.test(letter) || state.solvedAt) return state;

  const cell = state.selected;
  let next: PuzzleState = { ...state, started: true };

  if (state.marks[cell] !== 'revealed') {
    const letters = state.letters.slice();
    letters[cell] = letter;
    const marks = { ...state.marks };
    delete marks[cell];
    if (state.settings.autoCheck && letter !== puzzle.cells[cell].solution) marks[cell] = 'wrong';
    const pencils = { ...state.pencils };
    if (state.pencil) pencils[cell] = true;
    else delete pencils[cell];
    next = remember(state, afterLettersChanged(puzzle, state, { ...next, letters, marks, pencils }, now));
  }

  return { ...next, ...advance(puzzle, next) };
}

function backspace(puzzle: Puzzle, state: PuzzleState): PuzzleState {
  if (state.solvedAt) return state;
  const cell = state.selected;
  if (state.letters[cell] && state.marks[cell] !== 'revealed') {
    return remember(state, clearCells(state, [cell]));
  }
  // Empty (or locked) cell: move back one cell in the word and clear that one.
  const word = wordAt(puzzle, cell, state.direction);
  if (!word) return state;
  const index = word.cells.indexOf(cell);
  if (index === 0) return state;
  const previous = word.cells[index - 1];
  return remember(state, { ...clearCells(state, [previous]), selected: previous });
}

/** Clear letters (and 'wrong' marks) in the given cells, leaving revealed cells untouched. */
function clearCells(state: PuzzleState, cells: CellId[]): PuzzleState {
  if (state.solvedAt) return state;
  const letters = state.letters.slice();
  const marks = { ...state.marks };
  const pencils = { ...state.pencils };
  let changed = false;
  for (const id of cells) {
    if (marks[id] === 'revealed') continue;
    if (letters[id] !== null || marks[id] || pencils[id]) changed = true;
    letters[id] = null;
    delete marks[id];
    delete pencils[id];
  }
  return changed ? { ...state, letters, marks, pencils } : state;
}

// ---------------------------------------------------------------------------
// Check / reveal / clear

function scopeCells(puzzle: Puzzle, state: PuzzleState, scope: Scope): CellId[] {
  if (scope === 'letter') return [state.selected];
  if (scope === 'word') return wordAt(puzzle, state.selected, state.direction)?.cells ?? [];
  return puzzle.cells.filter((cell) => !cell.block).map((cell) => cell.id);
}

function scopeWord(puzzle: Puzzle, state: PuzzleState, scope: Scope): WordRef | null {
  if (scope === 'puzzle') return null;
  const word = wordAt(puzzle, state.selected, state.direction);
  return word ? { number: word.number, direction: word.direction } : null;
}

function check(puzzle: Puzzle, state: PuzzleState, scope: Scope): PuzzleState {
  const marks = { ...state.marks };
  let checked = 0;
  let wrong = 0;
  for (const id of scopeCells(puzzle, state, scope)) {
    const letter = state.letters[id];
    if (!letter || marks[id] === 'revealed') continue;
    checked++;
    if (letter === puzzle.cells[id].solution) {
      delete marks[id];
    } else {
      wrong++;
      marks[id] = 'wrong';
    }
  }
  return withEvent(
    { ...state, marks, stats: { ...state.stats, checks: state.stats.checks + (checked > 0 ? 1 : 0) } },
    { kind: 'checked', scope, word: scopeWord(puzzle, state, scope), checked, wrong },
  );
}

function reveal(puzzle: Puzzle, state: PuzzleState, scope: Scope, now = Date.now()): PuzzleState {
  if (state.solvedAt) return state;
  const letters = state.letters.slice();
  const marks = { ...state.marks };
  const pencils = { ...state.pencils };
  let changed = 0;
  for (const id of scopeCells(puzzle, state, scope)) {
    const solution = puzzle.cells[id].solution;
    delete pencils[id];
    if (letters[id] === solution) continue; // already right: no need to brand it as revealed
    letters[id] = solution;
    marks[id] = 'revealed';
    changed++;
  }
  const word = scopeWord(puzzle, state, scope);
  if (changed === 0) return withEvent(state, { kind: 'revealed', scope, word, changed });

  const next: PuzzleState = {
    ...state,
    letters,
    marks,
    pencils,
    started: true,
    stats: { ...state.stats, reveals: state.stats.reveals + 1 },
  };
  const settled = remember(state, afterLettersChanged(puzzle, state, next, now));
  // A solved-puzzle event is more important than "revealed" feedback.
  return settled.event !== next.event ? settled : withEvent(settled, { kind: 'revealed', scope, word, changed });
}

function clear(puzzle: Puzzle, state: PuzzleState, scope: 'word' | 'puzzle'): PuzzleState {
  if (scope === 'puzzle') {
    return withEvent(
      { ...createInitialState(puzzle), settings: state.settings, event: state.event },
      { kind: 'cleared', scope, word: null },
    );
  }
  const word = wordAt(puzzle, state.selected, state.direction);
  if (!word) return state;
  return withEvent(
    remember(state, { ...clearCells(state, word.cells), selected: word.cells[0] }),
    { kind: 'cleared', scope, word: { number: word.number, direction: word.direction } },
  );
}

// ---------------------------------------------------------------------------
// Undo / redo

const snapshotOf = (state: PuzzleState): Snapshot => ({
  letters: state.letters,
  marks: state.marks,
  pencils: state.pencils,
  selected: state.selected,
  direction: state.direction,
});

/** Record `before` in the undo history when `after` changed the grid contents. */
function remember(before: PuzzleState, after: PuzzleState): PuzzleState {
  if (before.letters === after.letters && before.marks === after.marks && before.pencils === after.pencils) return after;
  return { ...after, history: [...before.history.slice(-(HISTORY_LIMIT - 1)), snapshotOf(before)], future: [] };
}

function timeTravel(state: PuzzleState, direction: 'undo' | 'redo'): PuzzleState {
  if (state.solvedAt) return state;
  const source = direction === 'undo' ? state.history : state.future;
  if (source.length === 0) return state;
  const snapshot = source[source.length - 1];
  const remaining = source.slice(0, -1);
  const current = snapshotOf(state);
  const next: PuzzleState = {
    ...state,
    ...snapshot,
    history: direction === 'undo' ? remaining : [...state.history, current],
    future: direction === 'undo' ? [...state.future, current] : remaining,
  };
  return withEvent(next, { kind: direction === 'undo' ? 'undone' : 'redone' });
}

// ---------------------------------------------------------------------------
// Feedback

function withEvent(state: PuzzleState, payload: PuzzleEvent): PuzzleState {
  return { ...state, event: { seq: (state.event?.seq ?? 0) + 1, payload } };
}

/**
 * Compare letters before and after an edit and attach the right feedback
 * event: the puzzle is solved, one or more words just became correct, or the
 * grid is full but something is wrong.
 */
function afterLettersChanged(puzzle: Puzzle, before: PuzzleState, after: PuzzleState, now: number): PuzzleState {
  if (isPuzzleSolved(puzzle, after.letters)) {
    return withEvent({ ...after, solvedAt: now, pencils: {} }, { kind: 'puzzle-solved' });
  }
  const newlySolved = puzzle.words
    .filter((word) => isWordCorrect(puzzle, word, after.letters) && !isWordCorrect(puzzle, word, before.letters))
    .map((word) => word.id);
  if (newlySolved.length > 0) {
    return withEvent(after, { kind: 'word-solved', wordIds: newlySolved });
  }
  if (isPuzzleFilled(puzzle, after.letters) && !isPuzzleFilled(puzzle, before.letters)) {
    return withEvent(after, { kind: 'puzzle-filled-incorrect' });
  }
  return after;
}
