import { describe, expect, it } from 'vitest';
import raw from '../data/crossword.json';
import { parseEnumeration } from './enumeration';
import { parseCrossword } from './parse';
import type { RawCrossword } from './types';

const data = raw as RawCrossword;

describe('parseCrossword', () => {
  const puzzle = parseCrossword(data);

  it('indexes the grid', () => {
    expect(puzzle.width).toBe(13);
    expect(puzzle.height).toBe(13);
    expect(puzzle.cells).toHaveLength(169);
    expect(puzzle.cells[6].block).toBe(true); // "THRUSH#YANKED" -> index 6 is '#'
    expect(puzzle.cells[0].solution).toBe('T');
  });

  it('links every entry to its cells and numbers the starting cell', () => {
    expect(puzzle.words).toHaveLength(24);
    const across1 = puzzle.wordsById['1-across'];
    expect(across1.cells).toEqual([0, 1, 2, 3, 4, 5]);
    expect(puzzle.cells[0].number).toBe(1);
    expect(puzzle.cells[0].across).toBe('1-across');
    expect(puzzle.cells[0].down).toBe('1-down');
    // 9 across and 9 down share a start cell
    expect(puzzle.cells[puzzle.wordsById['9-down'].cells[0]].number).toBe(9);
  });

  it('keeps clue order per direction', () => {
    expect(puzzle.order.across.slice(0, 3)).toEqual(['1-across', '4-across', '8-across']);
    expect(puzzle.order.down.at(-1)).toBe('18-down');
  });

  it('derives word breaks from the enumeration', () => {
    expect(puzzle.wordsById['10-across'].separators).toEqual([{ after: 4, kind: 'space' }]);
    expect(puzzle.wordsById['12-across'].separators).toEqual([{ after: 4, kind: 'hyphen' }]);
    expect(puzzle.wordsById['6-down'].separators).toEqual([
      { after: 4, kind: 'hyphen' },
      { after: 6, kind: 'space' },
    ]);
    expect(puzzle.wordsById['1-across'].separators).toEqual([]);
  });

  it('rejects an answer that disagrees with the grid', () => {
    const broken: RawCrossword = {
      ...data,
      entries: { ...data.entries, across: [{ ...data.entries.across[0], answer: 'THRUSX' }] },
    };
    expect(() => parseCrossword(broken)).toThrow(/1 across/);
  });

  it('explains malformed uploads in plain words', () => {
    expect(() => parseCrossword({ title: 'Broken' } as unknown as RawCrossword)).toThrow(/"grid" must be an array/);
    expect(() => parseCrossword({ ...data, entries: { across: [{ number: 1 }] } } as unknown as RawCrossword)).toThrow(/"entries" must contain/);
    expect(() => parseCrossword({ ...data, entries: { across: [{ number: 1 }], down: [] } } as unknown as RawCrossword)).toThrow(/across entry needs/);
    expect(() => parseCrossword(null as unknown as RawCrossword)).toThrow(/JSON object/);
  });

  it('rejects an entry that runs off the grid', () => {
    const broken: RawCrossword = {
      ...data,
      entries: { across: [], down: [{ ...data.entries.down[0], column: 14 }] },
    };
    expect(() => parseCrossword(broken)).toThrow(/runs off the grid/);
  });
});

describe('parseEnumeration', () => {
  it('handles single words, spaces and hyphens', () => {
    expect(parseEnumeration('(6)')).toEqual([]);
    expect(parseEnumeration('(5,2)')).toEqual([{ after: 4, kind: 'space' }]);
    expect(parseEnumeration('(5-4)')).toEqual([{ after: 4, kind: 'hyphen' }]);
    expect(parseEnumeration('(5-2,6)')).toEqual([
      { after: 4, kind: 'hyphen' },
      { after: 6, kind: 'space' },
    ]);
  });

  it('ignores an enumeration that does not match the answer length', () => {
    expect(parseEnumeration('(5,2)', 6)).toEqual([]);
  });
});
