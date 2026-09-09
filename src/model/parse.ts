import { parseEnumeration } from './enumeration';
import type { Cell, Direction, Puzzle, RawCrossword, RawEntry, Word, WordId } from './types';

const DIRECTIONS: Direction[] = ['across', 'down'];

export const wordId = (number: number, direction: Direction): WordId => `${number}-${direction}`;

/**
 * Build the indexed `Puzzle` model from the raw JSON.
 *
 * The parser is deliberately strict: a clue that does not match the grid is
 * a data error we want to hear about at load time, not a silent bug during
 * play. Every check throws with a message that names the offending entry.
 */
export function parseCrossword(raw: RawCrossword): Puzzle {
  validateShape(raw);
  const height = raw.grid.length;
  if (height === 0) throw new Error('Crossword grid is empty.');
  const width = raw.grid[0].length;
  if (raw.grid.some((row) => row.length !== width)) {
    throw new Error('Crossword grid rows must all have the same length.');
  }

  const cells: Cell[] = [];
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const char = raw.grid[row][col];
      const block = char === raw.blocks;
      cells.push({
        id: row * width + col,
        row,
        col,
        block,
        solution: block ? null : char.toUpperCase(),
        number: null,
        across: null,
        down: null,
      });
    }
  }

  const words: Word[] = [];
  const wordsById: Record<WordId, Word> = {};
  const order: Record<Direction, WordId[]> = { across: [], down: [] };

  for (const direction of DIRECTIONS) {
    const entries = [...raw.entries[direction]].sort((a, b) => a.number - b.number);
    for (const entry of entries) {
      const word = buildWord(entry, direction, cells, width, height);
      words.push(word);
      wordsById[word.id] = word;
      order[direction].push(word.id);
    }
  }

  return { title: raw.title, language: raw.language ?? 'en', width, height, cells, words, wordsById, order };
}

/** Guard against malformed uploads so every problem is reported in plain words. */
function validateShape(raw: unknown): asserts raw is RawCrossword {
  const data = raw as Partial<RawCrossword> | null;
  if (!data || typeof data !== 'object') throw new Error('The crossword must be a JSON object.');
  if (typeof data.title !== 'string' || !data.title.trim()) throw new Error('The crossword needs a "title".');
  if (data.language !== undefined && data.language !== 'en' && data.language !== 'it') {
    throw new Error('"language" must be "en" or "it".');
  }
  if (!Array.isArray(data.grid) || data.grid.some((row) => typeof row !== 'string')) {
    throw new Error('"grid" must be an array of strings, one per row.');
  }
  if (typeof data.blocks !== 'string' || data.blocks.length !== 1) throw new Error('"blocks" must be a single character, e.g. "#".');
  const entries = data.entries;
  if (!entries || !Array.isArray(entries.across) || !Array.isArray(entries.down)) {
    throw new Error('"entries" must contain "across" and "down" arrays.');
  }
  for (const direction of DIRECTIONS) {
    for (const entry of entries[direction]) {
      const ok =
        entry &&
        typeof entry.number === 'number' &&
        typeof entry.row === 'number' &&
        typeof entry.column === 'number' &&
        typeof entry.answer === 'string' &&
        entry.answer.length > 0 &&
        typeof entry.clue === 'string' &&
        typeof entry.enumeration === 'string';
      if (!ok) throw new Error(`Each ${direction} entry needs number, row, column, answer, clue and enumeration.`);
    }
  }
}

function buildWord(entry: RawEntry, direction: Direction, cells: Cell[], width: number, height: number): Word {
  const id = wordId(entry.number, direction);
  const answer = entry.answer.toUpperCase();
  const label = `${entry.number} ${direction}`;
  const cellIds: number[] = [];

  for (let i = 0; i < answer.length; i++) {
    const row = entry.row - 1 + (direction === 'down' ? i : 0);
    const col = entry.column - 1 + (direction === 'across' ? i : 0);
    if (row < 0 || row >= height || col < 0 || col >= width) {
      throw new Error(`${label} runs off the grid.`);
    }
    const cell = cells[row * width + col];
    if (cell.block) {
      throw new Error(`${label} crosses a blocked cell at row ${row + 1}, column ${col + 1}.`);
    }
    if (cell.solution !== answer[i]) {
      throw new Error(`${label} answer "${answer}" does not match the grid at row ${row + 1}, column ${col + 1}.`);
    }
    if (cell[direction]) {
      throw new Error(`${label} overlaps ${cell[direction]}.`);
    }
    cell[direction] = id;
    cellIds.push(cell.id);
  }

  const start = cells[cellIds[0]];
  if (start.number !== null && start.number !== entry.number) {
    throw new Error(`${label} starts on a cell already numbered ${start.number}.`);
  }
  start.number = entry.number;

  return {
    id,
    number: entry.number,
    direction,
    clue: entry.clue,
    enumeration: entry.enumeration,
    answer,
    cells: cellIds,
    separators: parseEnumeration(entry.enumeration, answer.length),
  };
}
