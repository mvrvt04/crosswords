/**
 * Domain types for the crossword.
 *
 * `Raw*` mirrors the JSON file we are given. `Puzzle` is the normalised,
 * pre-indexed model the UI works with: every cell knows which words it
 * belongs to, and every word knows the ordered list of its cells.
 */

export type Direction = 'across' | 'down';

export interface RawEntry {
  number: number;
  /** 1-indexed */
  row: number;
  /** 1-indexed */
  column: number;
  answer: string;
  clue: string;
  /** e.g. "(6)", "(5,2)", "(5-4)" */
  enumeration: string;
}

export type PuzzleLanguage = 'en' | 'it';

export interface RawCrossword {
  title: string;
  /** Interface + clue language. Defaults to English when missing. */
  language?: PuzzleLanguage;
  grid: string[];
  blocks: string;
  entries: { across: RawEntry[]; down: RawEntry[] };
}

/** `${number}-${direction}`, e.g. "1-across" */
export type WordId = string;

/** Row-major index into `Puzzle.cells` (row * width + col). */
export type CellId = number;

export type SeparatorKind = 'space' | 'hyphen';

/** A word break inside an answer, drawn as a bar / dash after letter `after` (0-based). */
export interface Separator {
  after: number;
  kind: SeparatorKind;
}

export interface Cell {
  id: CellId;
  row: number;
  col: number;
  block: boolean;
  /** Upper-case solution letter, or null for a block. */
  solution: string | null;
  /** Clue number printed in the corner, if this cell starts a word. */
  number: number | null;
  across: WordId | null;
  down: WordId | null;
}

export interface Word {
  id: WordId;
  number: number;
  direction: Direction;
  clue: string;
  enumeration: string;
  answer: string;
  cells: CellId[];
  separators: Separator[];
}

export interface Puzzle {
  title: string;
  language: PuzzleLanguage;
  width: number;
  height: number;
  cells: Cell[];
  words: Word[];
  wordsById: Record<WordId, Word>;
  /** Word ids in clue-number order, per direction. */
  order: Record<Direction, WordId[]>;
}
