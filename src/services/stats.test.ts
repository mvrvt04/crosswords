import { describe, expect, it } from 'vitest';
import { SEED_PUZZLES } from '../data/seeds';
import { buildPuzzleRecord, dailyPuzzle, type Database } from './stats';

const puzzles = SEED_PUZZLES.map((seed, i) => buildPuzzleRecord(seed.data, seed.id, new Date(2026, 0, 1 + i).toISOString()));
const db: Database = { puzzles, players: [], games: [], sessions: [] };

describe('dailyPuzzle', () => {
  it('is the same puzzle for the whole day and changes the next day', () => {
    const morning = dailyPuzzle(db, 'en', new Date(2026, 8, 9, 8));
    const evening = dailyPuzzle(db, 'en', new Date(2026, 8, 9, 23));
    const tomorrow = dailyPuzzle(db, 'en', new Date(2026, 8, 10, 8));
    expect(morning?.id).toBe(evening?.id);
    expect(tomorrow?.id).not.toBe(morning?.id);
  });

  it('stays inside the requested language', () => {
    for (let d = 0; d < 14; d++) {
      expect(dailyPuzzle(db, 'it', new Date(2026, 8, 1 + d))?.language).toBe('it');
    }
  });

  it('honours an admin pin, but not an inactive one', () => {
    const pinned = { ...db, daily: { en: 'mini-friday' } };
    expect(dailyPuzzle(pinned, 'en')?.id).toBe('mini-friday');
    const hidden = { ...pinned, puzzles: puzzles.map((p) => (p.id === 'mini-friday' ? { ...p, active: false } : p)) };
    expect(dailyPuzzle(hidden, 'en')?.id).not.toBe('mini-friday');
  });

  it('falls back to any language when the requested one is empty', () => {
    const englishOnly = { ...db, puzzles: puzzles.filter((p) => p.language === 'en') };
    expect(dailyPuzzle(englishOnly, 'it')).not.toBeNull();
  });
});
