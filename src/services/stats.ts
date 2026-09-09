import { parseCrossword } from '../model/parse';
import type { PuzzleLanguage, RawCrossword } from '../model/types';
import type {
  AdminOverview,
  GameRecord,
  Player,
  PlayerProfile,
  PlayerRecord,
  PlayerRow,
  PlayerStats,
  PuzzleRecord,
  PuzzleStats,
  PuzzleSummary,
  Session,
} from './types';

/**
 * Pure computations shared by the server and the offline store, so both
 * modes report exactly the same numbers and apply the same rules.
 */

export interface Database {
  puzzles: PuzzleRecord[];
  players: PlayerRecord[];
  games: GameRecord[];
  sessions: Session[];
  /** Signed-in admin sessions (playerId is always "admin"). */
  adminSessions?: Session[];
  /** Admin-pinned "today's puzzle" per language. Missing = rotate by date. */
  daily?: Partial<Record<PuzzleLanguage, string>>;
}

export const isClean = (game: Pick<GameRecord, 'checks' | 'reveals'>): boolean => game.checks === 0 && game.reveals === 0;

const average = (values: number[]): number | null =>
  values.length === 0 ? null : Math.round(values.reduce((a, b) => a + b, 0) / values.length);

const min = (values: number[]): number | null => (values.length === 0 ? null : Math.min(...values));

export function summarise(puzzle: PuzzleRecord): PuzzleSummary {
  const { data: _data, ...summary } = puzzle;
  return summary;
}

/** Strip credentials before a player record leaves the store. */
export function publicPlayer(record: PlayerRecord): Player {
  const { passwordHash: _hash, loginToken: _token, ...player } = record;
  return player;
}

/** The player's own view of their account (never someone else's). */
export function playerProfile(record: PlayerRecord): PlayerProfile {
  return { ...publicPlayer(record), hasPassword: record.passwordHash !== null, password: record.password ?? null, loginToken: record.loginToken };
}

export const activePuzzles = (db: Database, language?: PuzzleLanguage): PuzzleRecord[] =>
  db.puzzles.filter((puzzle) => puzzle.active && (language === undefined || puzzle.language === language));

/** Validate a raw puzzle and build the stored record. Throws a readable message on bad data. */
export function buildPuzzleRecord(data: RawCrossword, id: string, createdAt: string): PuzzleRecord {
  const parsed = parseCrossword(data);
  return {
    id,
    title: parsed.title.trim(),
    language: parsed.language,
    width: parsed.width,
    height: parsed.height,
    wordCount: parsed.words.length,
    active: true,
    createdAt,
    plays: 0,
    data,
  };
}

export function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'puzzle'
  );
}

/** Unique id: slug, then slug-2, slug-3 ... */
export function uniqueId(base: string, existing: Iterable<string>): string {
  const taken = new Set(existing);
  const slug = slugify(base);
  if (!taken.has(slug)) return slug;
  for (let n = 2; ; n++) {
    const candidate = `${slug}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

// ---------------------------------------------------------------------------
// Accounts

/** Sign-in identifier: an email address (lower-cased). */
export const USERNAME_PATTERN = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
export const MAX_NAME = 40;

export function cleanDisplayName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
}

export function normaliseUsername(username: string): string {
  return username.trim().toLowerCase();
}

/** Returns a problem with a new account, or null when it is fine. */
export function validateNewPlayer(name: string, username: string, password: string | undefined, existing: PlayerRecord[]): string | null {
  if (!cleanDisplayName(name)) return 'A display name is required.';
  if (username.length > 64 || !USERNAME_PATTERN.test(username)) return 'Enter a valid email address.';
  if (existing.some((player) => player.username === username)) return `${username} already has an account.`;
  if (password !== undefined && password.length > 0 && password.length < 6) return 'Passwords need at least 6 characters.';
  return null;
}

// ---------------------------------------------------------------------------
// Stats

export function playerStats(db: Database, playerId: string): PlayerStats {
  const games = db.games
    .filter((game) => game.playerId === playerId)
    .sort((a, b) => b.solvedAt.localeCompare(a.solvedAt));
  const times = games.map((game) => game.timeMs);
  const active = db.puzzles.filter((puzzle) => puzzle.active);
  const solvedIds = new Set(games.map((game) => game.puzzleId));
  return {
    solved: games.length,
    bestMs: min(times),
    averageMs: average(times),
    totalMs: times.reduce((a, b) => a + b, 0),
    cleanSolves: games.filter(isClean).length,
    puzzlesSolved: active.filter((puzzle) => solvedIds.has(puzzle.id)).length,
    puzzlesAvailable: active.length,
    history: games,
  };
}

/**
 * Today's puzzle for a language: the admin's pin if there is one, otherwise
 * the active puzzles in creation order, rotated by the calendar day so
 * everyone sees the same puzzle on the same day.
 */
export function dailyPuzzle(db: Database, language: PuzzleLanguage, now = new Date()): PuzzleRecord | null {
  const pinnedId = db.daily?.[language];
  const pinned = pinnedId ? db.puzzles.find((puzzle) => puzzle.id === pinnedId && puzzle.active) : undefined;
  if (pinned) return pinned;
  let active = activePuzzles(db, language);
  if (active.length === 0) active = activePuzzles(db);
  if (active.length === 0) return null;
  const ordered = [...active].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const day = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000);
  return ordered[day % ordered.length];
}

export function playerRow(db: Database, player: PlayerRecord): PlayerRow {
  const own = db.games.filter((game) => game.playerId === player.id).sort((a, b) => b.solvedAt.localeCompare(a.solvedAt));
  return {
    ...publicPlayer(player),
    hasPassword: player.passwordHash !== null,
    loginToken: player.loginToken,
    games: own.length,
    bestMs: min(own.map((game) => game.timeMs)),
    lastPlayed: own[0]?.solvedAt ?? null,
  };
}

export function adminOverview(db: Database): AdminOverview {
  const games = [...db.games].sort((a, b) => b.solvedAt.localeCompare(a.solvedAt));
  const puzzleStats: PuzzleStats[] = db.puzzles.map((puzzle) => {
    const own = games.filter((game) => game.puzzleId === puzzle.id);
    const best = own.reduce<GameRecord | null>((acc, game) => (acc === null || game.timeMs < acc.timeMs ? game : acc), null);
    return {
      ...summarise(puzzle),
      plays: own.length,
      averageMs: average(own.map((game) => game.timeMs)),
      bestMs: best?.timeMs ?? null,
      bestPlayer: best?.playerName ?? null,
    };
  });
  const playerRows = db.players
    .map((player) => playerRow(db, player))
    .sort((a, b) => b.games - a.games || a.name.localeCompare(b.name));
  return {
    daily: db.daily ?? {},
    today: Object.fromEntries(
      (['en', 'it'] as PuzzleLanguage[]).map((language) => [language, dailyPuzzle(db, language)?.id]).filter(([, id]) => id),
    ),
    players: db.players.length,
    games: games.length,
    puzzles: db.puzzles.length,
    activePuzzles: db.puzzles.filter((puzzle) => puzzle.active).length,
    averageMs: average(games.map((game) => game.timeMs)),
    cleanRate: games.length === 0 ? null : games.filter(isClean).length / games.length,
    puzzleStats,
    recentGames: games.slice(0, 200),
    playerRows,
    activity: activityByDay(games, 14),
  };
}

/** Games per local calendar day for the last `days` days, oldest first. */
export function activityByDay(games: GameRecord[], days: number, now = new Date()): { date: string; games: number }[] {
  const key = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const counts = new Map<string, number>();
  for (const game of games) {
    const k = key(new Date(game.solvedAt));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const out: { date: string; games: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const k = key(date);
    out.push({ date: k, games: counts.get(k) ?? 0 });
  }
  return out;
}
