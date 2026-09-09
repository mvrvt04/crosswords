import { SEED_ACCOUNTS } from '../data/accounts';
import { buildDemoGames, DEMO_ACCOUNTS, withPlayCounts } from '../data/demo';
import { SEED_PUZZLES } from '../data/seeds';
import type { RawCrossword } from '../model/types';
import {
  activePuzzles,
  adminOverview,
  dailyPuzzle,
  buildPuzzleRecord,
  cleanDisplayName,
  normaliseUsername,
  playerProfile,
  playerRow,
  playerStats,
  publicPlayer,
  summarise,
  uniqueId,
  validateNewPlayer,
  type Database,
} from './stats';
import { ApiError, type Api, type AuthResult, type ErrorCode, type GameInput, type GameRecord, type PlayerRecord } from './types';

/**
 * Offline store: the whole "database" lives in this browser's localStorage.
 * Used automatically when the app is served as static files with no API
 * behind it. Passwords are kept in plain text here: it is a demo fallback,
 * not a security boundary (the real server hashes them).
 */

const KEY = 'apollo-crossword:db';
/** The offline admin account. A demo gate, not a security boundary. */
export const LOCAL_ADMIN = { email: 'admin@apollo.st', password: 'apollo', linkToken: 'admin-apollo-crossword' };

function seedDatabase(): Database {
  const createdAt = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const puzzles = SEED_PUZZLES.map((seed) => buildPuzzleRecord(seed.data, seed.id, createdAt));
  const players = [...SEED_ACCOUNTS, ...DEMO_ACCOUNTS].map((account) => ({
    id: account.id,
    name: account.name,
    username: account.username,
    createdAt,
    passwordHash: account.password === null ? null : `plain:${account.password}`,
    password: account.password,
    loginToken: account.loginToken,
  }));
  const games = buildDemoGames(players, puzzles);
  return { puzzles: withPlayCounts(puzzles, games), players, games, sessions: [], adminSessions: [], daily: {} };
}

function load(): Database {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const db = JSON.parse(raw) as Database;
      if (Array.isArray(db.puzzles) && Array.isArray(db.games) && Array.isArray(db.players) && Array.isArray(db.sessions)) return db;
    }
  } catch {
    // fall through to a fresh seed
  }
  return seedDatabase();
}

function save(db: Database): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    // quota or private mode: keep going in memory
  }
}

const delay = <T,>(value: T): Promise<T> => new Promise((resolve) => setTimeout(() => resolve(value), 30));
const fail = (message: string, status: number, code?: ErrorCode) => Promise.reject(new ApiError(message, status, code));

export function createLocalApi(): Api {
  let db = load();
  const commit = () => save(db);

  const requireKey = (key: string) => {
    if (!(db.adminSessions ?? []).some((session) => session.token === key)) {
      throw new ApiError('Please sign in to the admin again.', 401, 'sign-in-again');
    }
  };

  const startAdminSession = () => {
    const token = crypto.randomUUID();
    db = { ...db, adminSessions: [...(db.adminSessions ?? []), { token, playerId: 'admin', createdAt: new Date().toISOString() }] };
    commit();
    return { token };
  };

  const playerForToken = (token: string): PlayerRecord | null => {
    const session = db.sessions.find((candidate) => candidate.token === token);
    return session ? (db.players.find((player) => player.id === session.playerId) ?? null) : null;
  };

  const startSession = (player: PlayerRecord): AuthResult => {
    const token = crypto.randomUUID();
    db = { ...db, sessions: [...db.sessions, { token, playerId: player.id, createdAt: new Date().toISOString() }] };
    commit();
    return { token, player: publicPlayer(player) };
  };

  return {
    mode: 'local',

    auth: {
      login: (username, password) => {
        const player = db.players.find((candidate) => candidate.username === normaliseUsername(username));
        const ok = player && player.passwordHash !== null && player.passwordHash === `plain:${password}`;
        if (!ok) return fail('That username or password is not right.', 401, 'bad-credentials');
        return delay(startSession(player));
      },
      loginWithToken: (loginToken) => {
        const player = db.players.find((candidate) => candidate.loginToken === loginToken);
        if (!player) return fail('This sign-in link is not valid any more.', 401, 'bad-link');
        return delay(startSession(player));
      },
      me: (token) => {
        const player = playerForToken(token);
        return player ? delay(publicPlayer(player)) : fail('Please sign in again.', 401, 'sign-in-again');
      },
      logout: (token) => {
        db = { ...db, sessions: db.sessions.filter((session) => session.token !== token) };
        commit();
        return delay(undefined);
      },
    },

    listPuzzles: (language) => delay(activePuzzles(db, language).map(summarise)),

    getPuzzle: (id) => {
      const puzzle = db.puzzles.find((candidate) => candidate.id === id);
      return puzzle ? delay(puzzle) : fail('That puzzle does not exist.', 404, 'puzzle-missing');
    },

    dailyPuzzle: (language) => {
      const puzzle = dailyPuzzle(db, language);
      return puzzle ? delay(summarise(puzzle)) : fail('There are no puzzles to play yet.', 404, 'no-puzzles');
    },

    getMyStats: (token) => {
      const player = playerForToken(token);
      return player ? delay(playerStats(db, player.id)) : fail('Please sign in again.', 401, 'sign-in-again');
    },

    getMyProfile: (token) => {
      const player = playerForToken(token);
      return player ? delay(playerProfile(player)) : fail('Please sign in again.', 401, 'sign-in-again');
    },

    recordGame: (token, input: GameInput) => {
      const player = playerForToken(token);
      if (!player) return fail('Please sign in again.', 401, 'sign-in-again');
      const puzzle = db.puzzles.find((candidate) => candidate.id === input.puzzleId);
      if (!puzzle) return fail('Unknown puzzle.', 400);
      const game: GameRecord = {
        id: crypto.randomUUID(),
        playerId: player.id,
        playerName: player.name,
        puzzleId: puzzle.id,
        puzzleTitle: puzzle.title,
        timeMs: input.timeMs,
        checks: input.checks,
        reveals: input.reveals,
        solvedAt: new Date().toISOString(),
      };
      db = {
        ...db,
        games: [...db.games, game],
        puzzles: db.puzzles.map((candidate) => (candidate.id === puzzle.id ? { ...candidate, plays: candidate.plays + 1 } : candidate)),
      };
      commit();
      return delay(game);
    },

    admin: {
      login: (email, password) => {
        if (email.trim().toLowerCase() !== LOCAL_ADMIN.email || password !== LOCAL_ADMIN.password) {
          return fail('That email or password is not right.', 401, 'bad-credentials');
        }
        return delay(startAdminSession());
      },
      loginWithToken: (linkToken) => (linkToken === LOCAL_ADMIN.linkToken ? delay(startAdminSession()) : fail('This admin link is not valid.', 401, 'bad-link')),
      logout: (key) => {
        db = { ...db, adminSessions: (db.adminSessions ?? []).filter((session) => session.token !== key) };
        commit();
        return delay(undefined);
      },
      overview: (key) => {
        requireKey(key);
        return delay(adminOverview(db));
      },
      addPuzzle: (key, data: RawCrossword) => {
        requireKey(key);
        const record = buildPuzzleRecord(data, uniqueId(data.title, db.puzzles.map((puzzle) => puzzle.id)), new Date().toISOString());
        db = { ...db, puzzles: [...db.puzzles, record] };
        commit();
        return delay(summarise(record));
      },
      setActive: (key, id, active) => {
        requireKey(key);
        const puzzle = db.puzzles.find((candidate) => candidate.id === id);
        if (!puzzle) return fail('That puzzle does not exist.', 404);
        const updated = { ...puzzle, active };
        db = { ...db, puzzles: db.puzzles.map((candidate) => (candidate.id === id ? updated : candidate)) };
        commit();
        return delay(summarise(updated));
      },
      deletePuzzle: (key, id) => {
        requireKey(key);
        db = { ...db, puzzles: db.puzzles.filter((candidate) => candidate.id !== id) };
        commit();
        return delay(undefined);
      },
      setDaily: (key, language, id) => {
        requireKey(key);
        const daily = { ...(db.daily ?? {}) };
        if (id === null) delete daily[language];
        else daily[language] = id;
        db = { ...db, daily };
        commit();
        return delay(undefined);
      },
      createPlayer: (key, input) => {
        requireKey(key);
        const username = normaliseUsername(input.username);
        const problem = validateNewPlayer(input.name, username, input.password, db.players);
        if (problem) return fail(problem, 422);
        const record: PlayerRecord = {
          id: uniqueId(username, db.players.map((player) => player.id)),
          name: cleanDisplayName(input.name),
          username,
          createdAt: new Date().toISOString(),
          passwordHash: input.password ? `plain:${input.password}` : null,
          password: input.password ?? null,
          loginToken: crypto.randomUUID(),
        };
        db = { ...db, players: [...db.players, record] };
        commit();
        return delay(playerRow(db, record));
      },
      updatePlayer: (key, id, patch) => {
        requireKey(key);
        const player = db.players.find((candidate) => candidate.id === id);
        if (!player) return fail('That player does not exist.', 404);
        if (patch.password && patch.password.length < 6) return fail('Passwords need at least 6 characters.', 422);
        const updated: PlayerRecord = {
          ...player,
          name: patch.name !== undefined ? cleanDisplayName(patch.name) || player.name : player.name,
          passwordHash: patch.password === undefined ? player.passwordHash : patch.password === null ? null : `plain:${patch.password}`,
          password: patch.password === undefined ? (player.password ?? null) : patch.password,
          loginToken: patch.regenerateToken ? crypto.randomUUID() : player.loginToken,
        };
        db = { ...db, players: db.players.map((candidate) => (candidate.id === id ? updated : candidate)) };
        commit();
        return delay(playerRow(db, updated));
      },
      deletePlayer: (key, id) => {
        requireKey(key);
        db = { ...db, players: db.players.filter((candidate) => candidate.id !== id), sessions: db.sessions.filter((session) => session.playerId !== id) };
        commit();
        return delay(undefined);
      },
    },
  };
}
