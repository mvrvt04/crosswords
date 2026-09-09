import { describe, expect, it } from 'vitest';
import raw from '../data/crossword.json';
import { parseCrossword } from '../model/parse';
import type { RawCrossword } from '../model/types';
import { createInitialState, reduce, toSavedGame, type Action, type PuzzleState } from './reducer';
import { derive } from './selectors';

const puzzle = parseCrossword(raw as RawCrossword);
const cell = (row: number, col: number) => (row - 1) * puzzle.width + (col - 1);

function run(actions: Action[], from: PuzzleState = createInitialState(puzzle)): PuzzleState {
  return actions.reduce((state, action) => reduce(puzzle, state, action), from);
}

const type = (text: string): Action[] => [...text].map((letter) => ({ type: 'input', letter, now: 1 }));

describe('selection', () => {
  it('starts on the first across word', () => {
    const state = createInitialState(puzzle);
    expect(state.selected).toBe(cell(1, 1));
    expect(state.direction).toBe('across');
  });

  it('keeps the direction when clicking a cell that supports it, and flips it on a second click', () => {
    let state = run([{ type: 'select', cell: cell(1, 3) }]);
    expect(state.direction).toBe('across');
    state = run([{ type: 'select', cell: cell(1, 3) }], state);
    expect(state.direction).toBe('down');
  });

  it('switches direction when the cell only belongs to one word', () => {
    // Row 2, col 1 is the H of THUMBS (down only)
    const state = run([{ type: 'select', cell: cell(2, 1) }]);
    expect(state.direction).toBe('down');
  });

  it('ignores clicks on blocks', () => {
    const state = run([{ type: 'select', cell: cell(1, 7) }]);
    expect(state.selected).toBe(cell(1, 1));
  });

  it('selecting a clue lands on its first empty cell', () => {
    const state = run([...type('TH'), { type: 'selectWord', wordId: '1-across' }]);
    expect(state.selected).toBe(cell(1, 3));
  });
});

describe('typing', () => {
  it('fills the cell and advances within the word', () => {
    const state = run(type('TH'));
    expect(state.letters[cell(1, 1)]).toBe('T');
    expect(state.letters[cell(1, 2)]).toBe('H');
    expect(state.selected).toBe(cell(1, 3));
    expect(state.started).toBe(true);
  });

  it('skips already-filled cells and then moves to the next unfinished word', () => {
    let state = run([{ type: 'select', cell: cell(1, 3) }, ...type('R')]);
    state = run([{ type: 'select', cell: cell(1, 1) }, ...type('TH')], state);
    expect(state.selected).toBe(cell(1, 4)); // R was already there
    state = run(type('USH'), state);
    expect(state.selected).toBe(cell(1, 8)); // 4 across
    expect(state.direction).toBe('across');
  });

  it('ignores anything that is not a letter', () => {
    const state = run([{ type: 'input', letter: '1' }, { type: 'input', letter: ' ' }]);
    expect(state.letters.every((l) => l === null)).toBe(true);
  });

  it('backspace clears the current letter first, then walks back', () => {
    let state = run(type('THR'));
    expect(state.selected).toBe(cell(1, 4));
    state = run([{ type: 'backspace' }], state);
    expect(state.letters[cell(1, 3)]).toBeNull();
    expect(state.selected).toBe(cell(1, 3));
    state = run([{ type: 'backspace' }], state);
    expect(state.letters[cell(1, 2)]).toBeNull();
    expect(state.selected).toBe(cell(1, 2));
  });

  it('announces a word the moment it is completed correctly', () => {
    const state = run(type('THRUSH'));
    expect(state.event?.payload).toEqual({ kind: 'word-solved', wordIds: ['1-across'] });
    expect(derive(puzzle, state).solvedWords.has('1-across')).toBe(true);
  });

  it('flags wrong letters only when auto-check is on', () => {
    const off = run(type('X'));
    expect(off.marks[cell(1, 1)]).toBeUndefined();
    const on = run([{ type: 'setSetting', key: 'autoCheck', value: true }, ...type('X')]);
    expect(on.marks[cell(1, 1)]).toBe('wrong');
  });
});

describe('arrow keys', () => {
  it('a perpendicular arrow switches direction first, then moves', () => {
    let state = run([{ type: 'move', dr: 1, dc: 0 }]);
    expect(state.direction).toBe('down');
    expect(state.selected).toBe(cell(1, 1));
    state = run([{ type: 'move', dr: 1, dc: 0 }], state);
    expect(state.selected).toBe(cell(2, 1));
  });

  it('skips over blocks and stops at the edge', () => {
    let state = run([{ type: 'select', cell: cell(1, 6) }, { type: 'move', dr: 0, dc: 1 }]);
    expect(state.selected).toBe(cell(1, 8));
    state = run([{ type: 'move', dr: 0, dc: -1 }, { type: 'move', dr: 0, dc: -1 }], state);
    expect(state.selected).toBe(cell(1, 5));
    state = run(Array(10).fill({ type: 'move', dr: 0, dc: -1 }), state);
    expect(state.selected).toBe(cell(1, 1));
  });

  it('the clue-bar arrows browse every clue in order, including finished ones', () => {
    const state = run([...type('THRUSH'), { type: 'selectWord', wordId: '4-across' }, { type: 'nextWord', delta: -1, skipFilled: false }]);
    expect(state.selected).toBe(cell(1, 1));
    expect(state.direction).toBe('across');
  });

  it('tab moves to the next word that still needs letters', () => {
    let state = run([...type('THRUSH'), { type: 'selectWord', wordId: '1-across' }]);
    state = run([{ type: 'nextWord', delta: 1 }], state);
    expect(state.selected).toBe(cell(1, 8));
    state = run([{ type: 'nextWord', delta: -1 }], state);
    expect(state.direction).toBe('down');
    expect(state.selected).toBe(cell(9, 9)); // 18 down, wrapping around
  });
});

describe('check, reveal, clear', () => {
  it('check marks wrong letters and reports counts', () => {
    const state = run([...type('THRASH'), { type: 'selectWord', wordId: '1-across' }, { type: 'check', scope: 'word' }]);
    expect(state.marks[cell(1, 4)]).toBe('wrong');
    expect(state.event?.payload).toMatchObject({ kind: 'checked', checked: 6, wrong: 1, word: { number: 1, direction: 'across' } });
    expect(state.stats.checks).toBe(1);
  });

  it('editing a wrong cell clears its mark', () => {
    const state = run([
      ...type('THRASH'),
      { type: 'check', scope: 'puzzle' },
      { type: 'select', cell: cell(1, 4) },
      ...type('U'),
    ]);
    expect(state.marks[cell(1, 4)]).toBeUndefined();
  });

  it('reveal fills the word, locks the cells and leaves correct letters unmarked', () => {
    const state = run([...type('TH'), { type: 'selectWord', wordId: '1-across' }, { type: 'reveal', scope: 'word' }]);
    expect(state.letters.slice(0, 6).join('')).toBe('THRUSH');
    expect(state.marks[cell(1, 1)]).toBeUndefined();
    expect(state.marks[cell(1, 3)]).toBe('revealed');
    const after = run([{ type: 'select', cell: cell(1, 3) }, { type: 'backspace' }], state);
    expect(after.letters[cell(1, 3)]).toBe('R');
  });

  it('clearing a word keeps revealed letters', () => {
    const state = run([
      { type: 'reveal', scope: 'letter' },
      ...type('HRUSH'),
      { type: 'selectWord', wordId: '1-across' },
      { type: 'clear', scope: 'word' },
    ]);
    expect(state.letters[cell(1, 1)]).toBe('T');
    expect(state.letters[cell(1, 2)]).toBeNull();
  });
});

describe('completion', () => {
  it('detects a full but incorrect grid, then the solution', () => {
    let state = run([{ type: 'reveal', scope: 'puzzle', now: 5 }]);
    expect(state.solvedAt).toBe(5);
    expect(state.event?.payload).toEqual({ kind: 'puzzle-solved' });

    // Same again but with one deliberate mistake typed last.
    state = createInitialState(puzzle);
    for (const c of puzzle.cells) {
      if (c.block || c.id === cell(1, 1)) continue;
      state = reduce(puzzle, state, { type: 'select', cell: c.id });
      state = reduce(puzzle, state, { type: 'input', letter: c.solution!, now: 1 });
    }
    state = run([{ type: 'select', cell: cell(1, 1) }, ...type('X')], state);
    expect(state.event?.payload).toEqual({ kind: 'puzzle-filled-incorrect' });
    state = run([{ type: 'select', cell: cell(1, 1) }, ...type('T')], state);
    expect(state.solvedAt).toBe(1);
  });

  it('round-trips through the saved format', () => {
    const state = run([...type('THRUSH'), { type: 'reveal', scope: 'letter' }]);
    const restored = createInitialState(puzzle, toSavedGame(state));
    expect(restored.letters).toEqual(state.letters);
    expect(restored.selected).toBe(state.selected);
    expect(restored.started).toBe(true);
  });
});

describe('undo, redo and pencil', () => {
  it('undo restores letters and cursor; redo replays', () => {
    let state = run(type('THR'));
    state = run([{ type: 'undo' }], state);
    expect(state.letters[cell(1, 3)]).toBeNull();
    expect(state.selected).toBe(cell(1, 3));
    expect(state.event?.payload).toEqual({ kind: 'undone' });
    state = run([{ type: 'undo' }, { type: 'undo' }, { type: 'undo' }], state);
    expect(state.letters.every((l) => l === null)).toBe(true);
    expect(state.selected).toBe(cell(1, 1));
    state = run([{ type: 'redo' }], state);
    expect(state.letters[cell(1, 1)]).toBe('T');
  });

  it('a new edit after undo discards the redo stack', () => {
    let state = run([...type('TH'), { type: 'undo' }, ...type('X')]);
    expect(state.future).toHaveLength(0);
    state = run([{ type: 'redo' }], state);
    expect(state.letters[cell(1, 2)]).toBe('X');
  });

  it('undo covers reveal and clear word, but not navigation or checks', () => {
    let state = run([{ type: 'reveal', scope: 'word' }]);
    expect(state.history).toHaveLength(1);
    state = run([{ type: 'nextWord', delta: 1 }, { type: 'check', scope: 'puzzle' }], state);
    expect(state.history).toHaveLength(1);
    state = run([{ type: 'undo' }], state);
    expect(state.letters[cell(1, 1)]).toBeNull();
    expect(state.marks[cell(1, 1)]).toBeUndefined();
  });

  it('pencil letters are tentative but still count as answers', () => {
    let state = run([{ type: 'togglePencil' }, ...type('THRUSH')]);
    expect(state.pencils[cell(1, 1)]).toBe(true);
    expect(derive(puzzle, state).solvedWords.has('1-across')).toBe(true);
    // writing in pen over a pencil letter makes it permanent
    state = run([{ type: 'togglePencil' }, { type: 'select', cell: cell(1, 1) }, ...type('T')], state);
    expect(state.pencils[cell(1, 1)]).toBeUndefined();
    // revealing and clearing drop pencil marks
    state = run([{ type: 'togglePencil' }, { type: 'select', cell: cell(3, 1) }, ...type('X'), { type: 'select', cell: cell(3, 1) }, { type: 'reveal', scope: 'letter' }], state);
    expect(state.pencils[cell(3, 1)]).toBeUndefined();
    expect(toSavedGame(state).pencils).toEqual([cell(1, 2), cell(1, 3), cell(1, 4), cell(1, 5), cell(1, 6)]);
  });
});
