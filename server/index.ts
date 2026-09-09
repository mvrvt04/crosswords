/**
 * Apollo Crossword server.
 *
 * A single dependency-free Node process that serves the built frontend and a
 * small JSON API on top of a file-backed store. It reuses the client's puzzle
 * parser to validate uploads, and the shared `stats` module so the numbers
 * in the admin panel are computed by exactly the same code as offline mode.
 *
 * Accounts: no self-registration. The admin creates players; each player has
 * a personal sign-in link token and optionally a password (scrypt-hashed).
 * Sessions are random bearer tokens stored server-side.
 *
 * Bundled with esbuild (see package.json) so the imports from ../src work.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { promises as fs, existsSync } from 'node:fs';
import path from 'node:path';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { SEED_ACCOUNTS } from '../src/data/accounts';
import { buildDemoGames, DEMO_ACCOUNTS, withPlayCounts } from '../src/data/demo';
import { SEED_PUZZLES } from '../src/data/seeds';
import type { PuzzleLanguage, RawCrossword } from '../src/model/types';
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
} from '../src/services/stats';
import type { ErrorCode, GameRecord, PlayerRecord } from '../src/services/types';

const PORT = Number(process.env.PORT ?? 8787);
const DATA_DIR = process.env.DATA_DIR ?? path.resolve('data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const DIST_DIR = path.resolve('dist');
/** Admin account: email + password, plus a personal link token, all from the environment. */
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? 'admin@apollo.st').trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? process.env.ADMIN_KEY ?? 'apollo';
const ADMIN_LINK_TOKEN = process.env.ADMIN_LINK_TOKEN ?? 'admin-apollo-crossword';
const ADMIN_SESSION_DAYS = 30;
const MAX_BODY = 512 * 1024;
const SESSION_DAYS = 90;
/** Fresh databases get demo players and a week of games unless SEED_DEMO=false. */
const SEED_DEMO = process.env.SEED_DEMO !== 'false';

// ---------------------------------------------------------------------------
// Passwords

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  return `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const [scheme, salt, hash] = stored.split(':');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

const newToken = () => randomBytes(24).toString('base64url');

// ---------------------------------------------------------------------------
// Store: whole database in memory, persisted atomically after each change.

let db: Database;
let writing: Promise<void> = Promise.resolve();

function seedPlayers(createdAt: string, accounts = SEED_ACCOUNTS): PlayerRecord[] {
  return accounts.map((account) => ({
    id: account.id,
    name: account.name,
    username: account.username,
    createdAt,
    passwordHash: account.password === null ? null : hashPassword(account.password),
    password: account.password,
    loginToken: account.loginToken,
  }));
}

async function loadDatabase(): Promise<Database> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const createdAt = new Date().toISOString();
  if (existsSync(DB_FILE)) {
    try {
      const parsed = JSON.parse(await fs.readFile(DB_FILE, 'utf8')) as Partial<Database>;
      if (Array.isArray(parsed.puzzles) && Array.isArray(parsed.players) && Array.isArray(parsed.games)) {
        const players = parsed.players as PlayerRecord[];
        // Make sure the seeded accounts exist even in an older database.
        const missing = seedPlayers(createdAt).filter((seed) => !players.some((p) => p.id === seed.id || p.username === seed.username));
        const missingPuzzles = SEED_PUZZLES.filter((seed) => !parsed.puzzles!.some((p) => p.id === seed.id)).map((seed) =>
          buildPuzzleRecord(seed.data, seed.id, createdAt),
        );
        return {
          puzzles: [...parsed.puzzles, ...missingPuzzles],
          players: [...players, ...missing],
          games: parsed.games,
          sessions: parsed.sessions ?? [],
          adminSessions: parsed.adminSessions ?? [],
          daily: parsed.daily ?? {},
        };
      }
    } catch (error) {
      console.error('Could not read the database, starting fresh:', error);
    }
  }
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const puzzles = SEED_PUZZLES.map((seed) => buildPuzzleRecord(seed.data, seed.id, weekAgo));
  const players = seedPlayers(weekAgo, SEED_DEMO ? [...SEED_ACCOUNTS, ...DEMO_ACCOUNTS] : SEED_ACCOUNTS);
  const games = SEED_DEMO ? buildDemoGames(players, puzzles) : [];
  return { puzzles: withPlayCounts(puzzles, games), players, games, sessions: [], adminSessions: [], daily: {} };
}

function persist(): void {
  const snapshot = JSON.stringify(db, null, 2);
  writing = writing.then(async () => {
    const tmp = `${DB_FILE}.${process.pid}.tmp`;
    await fs.writeFile(tmp, snapshot, 'utf8');
    await fs.rename(tmp, DB_FILE);
  });
  writing.catch((error) => console.error('Could not save the database:', error));
}

// ---------------------------------------------------------------------------
// HTTP helpers

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: ErrorCode,
  ) {
    super(message);
  }
}

const languageParam = (url: URL): PuzzleLanguage | undefined => {
  const value = url.searchParams.get('language');
  return value === 'en' || value === 'it' ? value : undefined;
};

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function empty(res: ServerResponse): void {
  res.writeHead(204);
  res.end();
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new HttpError(413, 'That upload is too large (limit 512 KB).');
    chunks.push(chunk as Buffer);
  }
  if (chunks.length === 0) throw new HttpError(400, 'A JSON body is required.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'The body is not valid JSON.');
  }
  if (typeof parsed !== 'object' || parsed === null) throw new HttpError(400, 'The body must be a JSON object.');
  return parsed as Record<string, unknown>;
}

/** Constant-time string comparison for the admin credentials. */
function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function requireAdmin(req: IncomingMessage): void {
  const token = req.headers['x-admin-key'];
  const session = typeof token === 'string' ? db.adminSessions?.find((s) => s.token === token) : undefined;
  if (!session) throw new HttpError(401, 'Please sign in to the admin again.', 'sign-in-again');
  const ageDays = (Date.now() - Date.parse(session.createdAt)) / 86_400_000;
  if (ageDays > ADMIN_SESSION_DAYS) throw new HttpError(401, 'Your admin session has expired. Please sign in again.', 'sign-in-again');
}

function startAdminSession() {
  const token = newToken();
  db = { ...db, adminSessions: [...(db.adminSessions ?? []), { token, playerId: 'admin', createdAt: new Date().toISOString() }] };
  persist();
  return { token };
}

function sessionToken(req: IncomingMessage): string | null {
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7) : null;
}

function requirePlayer(req: IncomingMessage): PlayerRecord {
  const token = sessionToken(req);
  const session = token ? db.sessions.find((s) => s.token === token) : undefined;
  const player = session ? db.players.find((p) => p.id === session.playerId) : undefined;
  if (!session || !player) throw new HttpError(401, 'Please sign in again.', 'sign-in-again');
  const ageDays = (Date.now() - Date.parse(session.createdAt)) / 86_400_000;
  if (ageDays > SESSION_DAYS) throw new HttpError(401, 'Your session has expired. Please sign in again.', 'sign-in-again');
  return player;
}

function startSession(player: PlayerRecord) {
  const token = newToken();
  db = { ...db, sessions: [...db.sessions, { token, playerId: player.id, createdAt: new Date().toISOString() }] };
  persist();
  return { token, player: publicPlayer(player) };
}

const str = (value: unknown): string => (typeof value === 'string' ? value : '');

// ---------------------------------------------------------------------------
// API routes

async function handleApi(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const method = req.method ?? 'GET';
  const [head, second, third] = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);

  if (head === 'health' && method === 'GET') return json(res, 200, { ok: true, puzzles: db.puzzles.length });

  // ---- auth
  if (head === 'auth') {
    if (second === 'login' && method === 'POST') {
      const body = await readJson(req);
      const username = normaliseUsername(str(body.username));
      const player = db.players.find((p) => p.username === username);
      if (!player || !verifyPassword(str(body.password), player.passwordHash)) {
        throw new HttpError(401, 'That username or password is not right.', 'bad-credentials');
      }
      return json(res, 200, startSession(player));
    }
    if (second === 'token' && method === 'POST') {
      const body = await readJson(req);
      const player = db.players.find((p) => p.loginToken === str(body.loginToken));
      if (!player) throw new HttpError(401, 'This sign-in link is not valid any more.', 'bad-link');
      return json(res, 200, startSession(player));
    }
    if (second === 'me' && method === 'GET') return json(res, 200, publicPlayer(requirePlayer(req)));
    if (second === 'logout' && method === 'POST') {
      const token = sessionToken(req);
      db = { ...db, sessions: db.sessions.filter((s) => s.token !== token) };
      persist();
      return empty(res);
    }
  }

  // ---- puzzles
  if (head === 'puzzles' && method === 'GET') {
    if (second === undefined) return json(res, 200, activePuzzles(db, languageParam(url)).map(summarise));
    if (second === 'daily') {
      const puzzle = dailyPuzzle(db, languageParam(url) ?? 'en');
      if (!puzzle) throw new HttpError(404, 'There are no puzzles to play yet.', 'no-puzzles');
      return json(res, 200, summarise(puzzle));
    }
    const puzzle = db.puzzles.find((p) => p.id === second);
    if (!puzzle) throw new HttpError(404, 'That puzzle does not exist.', 'puzzle-missing');
    return json(res, 200, puzzle);
  }

  // ---- the signed-in player
  if (head === 'me' && method === 'GET') {
    const player = requirePlayer(req);
    if (second === undefined) return json(res, 200, playerProfile(player));
    if (second === 'stats') return json(res, 200, playerStats(db, player.id));
  }

  if (head === 'games' && method === 'POST') {
    const player = requirePlayer(req);
    const body = await readJson(req);
    const { puzzleId, timeMs, checks, reveals } = body;
    const numbers = [timeMs, checks, reveals];
    if (typeof puzzleId !== 'string' || !numbers.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0)) {
      throw new HttpError(400, 'Invalid game.');
    }
    const puzzle = db.puzzles.find((p) => p.id === puzzleId);
    if (!puzzle) throw new HttpError(400, 'Unknown puzzle.');
    const game: GameRecord = {
      id: randomUUID(),
      playerId: player.id,
      playerName: player.name,
      puzzleId,
      puzzleTitle: puzzle.title,
      timeMs: Math.round(timeMs as number),
      checks: Math.round(checks as number),
      reveals: Math.round(reveals as number),
      solvedAt: new Date().toISOString(),
    };
    db = { ...db, games: [...db.games, game], puzzles: db.puzzles.map((p) => (p.id === puzzle.id ? { ...p, plays: p.plays + 1 } : p)) };
    persist();
    return json(res, 201, game);
  }

  // ---- admin
  if (head === 'admin') {
    if (second === 'login' && method === 'POST') {
      const body = await readJson(req);
      const email = str(body.email).trim().toLowerCase();
      if (!sameSecret(email, ADMIN_EMAIL) || !sameSecret(str(body.password), ADMIN_PASSWORD)) {
        throw new HttpError(401, 'That email or password is not right.', 'bad-credentials');
      }
      return json(res, 200, startAdminSession());
    }
    if (second === 'token' && method === 'POST') {
      const body = await readJson(req);
      if (!sameSecret(str(body.linkToken), ADMIN_LINK_TOKEN)) throw new HttpError(401, 'This admin link is not valid.', 'bad-link');
      return json(res, 200, startAdminSession());
    }
    if (second === 'logout' && method === 'POST') {
      const token = req.headers['x-admin-key'];
      db = { ...db, adminSessions: (db.adminSessions ?? []).filter((s) => s.token !== token) };
      persist();
      return empty(res);
    }
    requireAdmin(req);
    if (second === 'overview' && method === 'GET') return json(res, 200, adminOverview(db));

    if (second === 'puzzles' && method === 'POST') {
      const data = (await readJson(req)) as unknown as RawCrossword;
      let record;
      try {
        record = buildPuzzleRecord(data, uniqueId(String(data.title ?? ''), db.puzzles.map((p) => p.id)), new Date().toISOString());
      } catch (error) {
        throw new HttpError(422, error instanceof Error ? error.message : 'That crossword is not valid.');
      }
      db = { ...db, puzzles: [...db.puzzles, record] };
      persist();
      return json(res, 201, summarise(record));
    }
    if (second === 'puzzles' && third && method === 'PATCH') {
      const body = await readJson(req);
      if (typeof body.active !== 'boolean') throw new HttpError(400, 'active (boolean) is required.');
      const puzzle = db.puzzles.find((p) => p.id === third);
      if (!puzzle) throw new HttpError(404, 'That puzzle does not exist.');
      const updated = { ...puzzle, active: body.active };
      db = { ...db, puzzles: db.puzzles.map((p) => (p.id === third ? updated : p)) };
      persist();
      return json(res, 200, summarise(updated));
    }
    if (second === 'puzzles' && third && method === 'DELETE') {
      if (!db.puzzles.some((p) => p.id === third)) throw new HttpError(404, 'That puzzle does not exist.');
      db = { ...db, puzzles: db.puzzles.filter((p) => p.id !== third) };
      persist();
      return empty(res);
    }

    if (second === 'daily' && method === 'PUT') {
      const body = await readJson(req);
      const language = body.language;
      if (language !== 'en' && language !== 'it') throw new HttpError(400, 'language must be en or it.');
      if (body.id !== null && (typeof body.id !== 'string' || !db.puzzles.some((p) => p.id === body.id))) {
        throw new HttpError(404, 'That puzzle does not exist.');
      }
      const daily = { ...(db.daily ?? {}) };
      if (body.id === null) delete daily[language];
      else daily[language] = body.id as string;
      db = { ...db, daily };
      persist();
      return empty(res);
    }

    if (second === 'players' && method === 'POST') {
      const body = await readJson(req);
      const name = cleanDisplayName(str(body.name));
      const username = normaliseUsername(str(body.username));
      const password = typeof body.password === 'string' && body.password.length > 0 ? body.password : undefined;
      const problem = validateNewPlayer(name, username, password, db.players);
      if (problem) throw new HttpError(422, problem);
      const record: PlayerRecord = {
        id: uniqueId(username, db.players.map((p) => p.id)),
        name,
        username,
        createdAt: new Date().toISOString(),
        passwordHash: password ? hashPassword(password) : null,
        password: password ?? null,
        loginToken: newToken(),
      };
      db = { ...db, players: [...db.players, record] };
      persist();
      return json(res, 201, playerRow(db, record));
    }
    if (second === 'players' && third && method === 'PATCH') {
      const body = await readJson(req);
      const player = db.players.find((p) => p.id === third);
      if (!player) throw new HttpError(404, 'That player does not exist.');
      if (typeof body.password === 'string' && body.password.length < 6) throw new HttpError(422, 'Passwords need at least 6 characters.');
      const updated: PlayerRecord = {
        ...player,
        name: typeof body.name === 'string' ? cleanDisplayName(body.name) || player.name : player.name,
        passwordHash: body.password === null ? null : typeof body.password === 'string' ? hashPassword(body.password) : player.passwordHash,
        password: body.password === null ? null : typeof body.password === 'string' ? body.password : (player.password ?? null),
        loginToken: body.regenerateToken === true ? newToken() : player.loginToken,
      };
      db = { ...db, players: db.players.map((p) => (p.id === third ? updated : p)) };
      persist();
      return json(res, 200, playerRow(db, updated));
    }
    if (second === 'players' && third && method === 'DELETE') {
      if (!db.players.some((p) => p.id === third)) throw new HttpError(404, 'That player does not exist.');
      db = { ...db, players: db.players.filter((p) => p.id !== third), sessions: db.sessions.filter((s) => s.playerId !== third) };
      persist();
      return empty(res);
    }
  }

  throw new HttpError(404, 'Not found.');
}

// ---------------------------------------------------------------------------
// Static files (the Vite build) with SPA fallback

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

async function serveStatic(res: ServerResponse, pathname: string): Promise<void> {
  const safe = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = path.join(DIST_DIR, safe);
  if (!file.startsWith(DIST_DIR)) throw new HttpError(403, 'Forbidden');
  let stat = await fs.stat(file).catch(() => null);
  if (!stat || stat.isDirectory()) {
    file = path.join(DIST_DIR, 'index.html');
    stat = await fs.stat(file).catch(() => null);
    if (!stat) throw new HttpError(404, 'The frontend has not been built. Run `npm run build` first.');
  }
  const ext = path.extname(file);
  const immutable = file.includes(`${path.sep}assets${path.sep}`);
  res.writeHead(200, {
    'Content-Type': MIME[ext] ?? 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  res.end(await fs.readFile(file));
}

// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  db = await loadDatabase();
  persist();

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    try {
      if (url.pathname.startsWith('/api')) await handleApi(req, res, url);
      else if (req.method === 'GET' || req.method === 'HEAD') await serveStatic(res, url.pathname);
      else throw new HttpError(405, 'Method not allowed.');
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      if (status === 500) console.error(error);
      json(res, status, { error: error instanceof Error ? error.message : 'Something went wrong.', code: error instanceof HttpError ? error.code : undefined });
    }
  });

  server.listen(PORT, () => {
    console.log(`Apollo Crossword listening on http://localhost:${PORT} (${db.puzzles.length} puzzles, ${db.players.length} players, data in ${DB_FILE})`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
