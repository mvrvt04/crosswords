import { otherDirection, solvedWordIds, wordAt } from '../model/navigation';
import type { Puzzle, Word, WordId } from '../model/types';
import type { PuzzleState } from './reducer';

export interface Progress {
  filledCells: number;
  totalCells: number;
  solvedWords: number;
  totalWords: number;
  /** 0..1, based on words solved */
  fraction: number;
}

export interface Derived {
  currentWord: Word | null;
  /** The word running the other way through the selected cell. */
  crossingWord: Word | null;
  solvedWords: Set<WordId>;
  progress: Progress;
}

/** Everything the UI needs that can be computed from state; cheap enough to recompute per render. */
export function derive(puzzle: Puzzle, state: PuzzleState): Derived {
  const currentWord = wordAt(puzzle, state.selected, state.direction);
  const crossingWord = wordAt(puzzle, state.selected, otherDirection(state.direction));
  const solvedWords = solvedWordIds(puzzle, state.letters);
  const totalCells = puzzle.cells.filter((cell) => !cell.block).length;
  const filledCells = state.letters.filter(Boolean).length;
  const totalWords = puzzle.words.length;
  return {
    currentWord,
    crossingWord,
    solvedWords,
    progress: {
      filledCells,
      totalCells,
      solvedWords: solvedWords.size,
      totalWords,
      fraction: totalWords === 0 ? 0 : solvedWords.size / totalWords,
    },
  };
}
