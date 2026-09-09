import { describe, expect, it } from 'vitest';
import { parseCrossword } from '../model/parse';
import { SEED_ACCOUNTS } from './accounts';
import { buildDemoGames, DEMO_ACCOUNTS, withPlayCounts } from './demo';
import { SEED_PUZZLES } from './seeds';
import type { PlayerRecord, PuzzleRecord } from '../services/types';

const players: PlayerRecord[] = [...SEED_ACCOUNTS, ...DEMO_ACCOUNTS].map((a) => ({
  id: a.id, name: a.name, username: a.username, createdAt: '2026-01-01T00:00:00.000Z', passwordHash: null, loginToken: a.loginToken,
}));
const puzzles: PuzzleRecord[] = SEED_PUZZLES.map((s) => {
  const p = parseCrossword(s.data);
  return { id: s.id, title: p.title, language: p.language, width: p.width, height: p.height, wordCount: p.words.length, active: true, createdAt: '', plays: 0, data: s.data };
});

describe('demo data', () => {
  const now = new Date('2026-09-09T10:00:00');
  const games = buildDemoGames(players, puzzles, now);

  it('resolves every game to a real player and puzzle, in the past, in order', () => {
    expect(games).toHaveLength(20);
    for (const game of games) expect(Date.parse(game.solvedAt)).toBeLessThanOrEqual(now.getTime());
    expect([...games].sort((a, b) => a.solvedAt.localeCompare(b.solvedAt))).toEqual(games);
  });

  it('leaves the example crossword unsolved for the reviewer account', () => {
    expect(games.some((g) => g.playerId === 'matteo-natale' && g.puzzleId === 'example-crossword')).toBe(false);
    expect(games.filter((g) => g.playerId === 'matteo-natale')).toHaveLength(11);
    const solvedByMatteo = new Set(games.filter((g) => g.playerId === 'matteo-natale').map((g) => g.puzzleId));
    expect(puzzles.filter((p) => !solvedByMatteo.has(p.id) && p.language === 'en').map((p) => p.id)).toEqual(['example-crossword']);
  });

  it('keeps play counts consistent', () => {
    const counted = withPlayCounts(puzzles, games);
    expect(counted.reduce((n, p) => n + p.plays, 0)).toBe(games.length);
  });

  it('uses unique usernames and tokens across all seeded accounts', () => {
    const all = [...SEED_ACCOUNTS, ...DEMO_ACCOUNTS];
    expect(new Set(all.map((a) => a.username)).size).toBe(all.length);
    expect(new Set(all.map((a) => a.loginToken)).size).toBe(all.length);
  });
});
