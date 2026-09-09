import type { GameRecord, PlayerRecord, PuzzleRecord } from '../services/types';
import type { SeedAccount } from './accounts';

/**
 * Demo data written once, when a database is created from scratch, so a
 * fresh deployment does not open on an empty dashboard and an empty admin.
 *
 * The seeded reviewer account keeps the full-size Example Crossword
 * unsolved on purpose: "Play a random crossword" then offers it first.
 */

export const DEMO_ACCOUNTS: SeedAccount[] = [
  { id: 'giulia-ferrari', name: 'Giulia Ferrari', username: 'giulia@example.com', password: null, loginToken: 'demo-giulia-4f1c' },
  { id: 'luca-bianchi', name: 'Luca Bianchi', username: 'luca@example.com', password: null, loginToken: 'demo-luca-9b2e' },
  { id: 'sara-conti', name: 'Sara Conti', username: 'sara@example.com', password: null, loginToken: 'demo-sara-7d3a' },
];

interface DemoGame {
  playerId: string;
  puzzleId: string;
  /** "m:ss" */
  time: string;
  checks: number;
  reveals: number;
  daysAgo: number;
  /** Hour of that day, 24h local time of the server. */
  hour: number;
}

const DEMO_GAMES: DemoGame[] = [
  // Matteo Natale: warming up on the minis, the big one still waiting
  { playerId: 'matteo-natale', puzzleId: 'mini-monday', time: '1:52', checks: 1, reveals: 0, daysAgo: 6, hour: 8 },
  { playerId: 'matteo-natale', puzzleId: 'mini-tuesday', time: '2:10', checks: 0, reveals: 1, daysAgo: 6, hour: 8 },
  { playerId: 'matteo-natale', puzzleId: 'mini-monday', time: '1:07', checks: 0, reveals: 0, daysAgo: 4, hour: 13 },
  { playerId: 'matteo-natale', puzzleId: 'mini-tuesday', time: '1:24', checks: 0, reveals: 0, daysAgo: 3, hour: 19 },
  { playerId: 'matteo-natale', puzzleId: 'mini-monday', time: '0:49', checks: 0, reveals: 0, daysAgo: 1, hour: 9 },
  { playerId: 'matteo-natale', puzzleId: 'mini-wednesday', time: '1:41', checks: 0, reveals: 0, daysAgo: 5, hour: 20 },
  { playerId: 'matteo-natale', puzzleId: 'mini-thursday', time: '2:03', checks: 2, reveals: 0, daysAgo: 4, hour: 21 },
  { playerId: 'matteo-natale', puzzleId: 'mini-friday', time: '1:19', checks: 0, reveals: 0, daysAgo: 2, hour: 8 },
  { playerId: 'matteo-natale', puzzleId: 'mini-saturday', time: '1:36', checks: 0, reveals: 1, daysAgo: 2, hour: 18 },
  { playerId: 'matteo-natale', puzzleId: 'mini-lunedi', time: '1:12', checks: 0, reveals: 0, daysAgo: 1, hour: 21 },
  { playerId: 'matteo-natale', puzzleId: 'mini-tuesday', time: '0:58', checks: 1, reveals: 0, daysAgo: 0, hour: 7 },
  { playerId: 'giulia-ferrari', puzzleId: 'mini-friday', time: '1:27', checks: 0, reveals: 0, daysAgo: 3, hour: 13 },
  { playerId: 'sara-conti', puzzleId: 'mini-saturday', time: '1:11', checks: 1, reveals: 0, daysAgo: 0, hour: 5 },
  // Other players
  { playerId: 'giulia-ferrari', puzzleId: 'example-crossword', time: '11:42', checks: 2, reveals: 0, daysAgo: 5, hour: 21 },
  { playerId: 'giulia-ferrari', puzzleId: 'mini-monday', time: '1:15', checks: 0, reveals: 0, daysAgo: 2, hour: 12 },
  { playerId: 'giulia-ferrari', puzzleId: 'mini-tuesday', time: '1:33', checks: 0, reveals: 0, daysAgo: 1, hour: 18 },
  { playerId: 'luca-bianchi', puzzleId: 'mini-monday', time: '2:31', checks: 0, reveals: 1, daysAgo: 3, hour: 10 },
  { playerId: 'luca-bianchi', puzzleId: 'example-crossword', time: '16:05', checks: 3, reveals: 1, daysAgo: 2, hour: 22 },
  { playerId: 'sara-conti', puzzleId: 'mini-tuesday', time: '1:02', checks: 0, reveals: 0, daysAgo: 1, hour: 14 },
  { playerId: 'sara-conti', puzzleId: 'mini-monday', time: '0:55', checks: 0, reveals: 0, daysAgo: 0, hour: 6 },
];

function parseTime(text: string): number {
  const [minutes, seconds] = text.split(':').map(Number);
  return (minutes * 60 + seconds) * 1000;
}

function when(now: Date, daysAgo: number, hour: number): string {
  const date = new Date(now);
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, 7 + ((daysAgo * 11 + hour * 3) % 45), 0, 0);
  // Never in the future: an early-morning boot with daysAgo 0 and a later hour
  if (date.getTime() > now.getTime()) date.setTime(now.getTime() - 5 * 60_000);
  return date.toISOString();
}

/** Games for the demo, resolved against the actual player and puzzle records. */
export function buildDemoGames(players: PlayerRecord[], puzzles: PuzzleRecord[], now = new Date()): GameRecord[] {
  const games: GameRecord[] = [];
  DEMO_GAMES.forEach((demo, index) => {
    const player = players.find((candidate) => candidate.id === demo.playerId);
    const puzzle = puzzles.find((candidate) => candidate.id === demo.puzzleId);
    if (!player || !puzzle) return;
    games.push({
      id: `demo-${index + 1}`,
      playerId: player.id,
      playerName: player.name,
      puzzleId: puzzle.id,
      puzzleTitle: puzzle.title,
      timeMs: parseTime(demo.time),
      checks: demo.checks,
      reveals: demo.reveals,
      solvedAt: when(now, demo.daysAgo, demo.hour),
    });
  });
  return games.sort((a, b) => a.solvedAt.localeCompare(b.solvedAt));
}

/** Puzzle records with `plays` matching the games. */
export function withPlayCounts(puzzles: PuzzleRecord[], games: GameRecord[]): PuzzleRecord[] {
  return puzzles.map((puzzle) => ({ ...puzzle, plays: games.filter((game) => game.puzzleId === puzzle.id).length }));
}
