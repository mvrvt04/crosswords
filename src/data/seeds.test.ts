import { describe, expect, it } from 'vitest';
import { parseCrossword } from '../model/parse';
import { SEED_PUZZLES } from './seeds';

describe('seed puzzles', () => {
  it('all parse and have unique ids', () => {
    const ids = new Set(SEED_PUZZLES.map((p) => p.id));
    expect(ids.size).toBe(SEED_PUZZLES.length);
    for (const seed of SEED_PUZZLES) {
      const puzzle = parseCrossword(seed.data);
      expect(puzzle.words.length).toBeGreaterThan(0);
      expect(puzzle.title).toBeTruthy();
    }
  });
});
