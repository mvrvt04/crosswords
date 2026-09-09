import type { PuzzleLanguage, RawCrossword } from '../model/types';

/** Shared contract between the client, the server and the offline store. */

export interface PuzzleSummary {
  id: string;
  title: string;
  language: PuzzleLanguage;
  width: number;
  height: number;
  wordCount: number;
  active: boolean;
  createdAt: string;
  plays: number;
}

export interface PuzzleRecord extends PuzzleSummary {
  data: RawCrossword;
}

/** What a signed-in player knows about themselves. */
export interface Player {
  id: string;
  name: string;
  username: string;
  createdAt: string;
}

/** The player's own account details, for the settings page. */
export interface PlayerProfile extends Player {
  hasPassword: boolean;
  /** The player's own password, shown behind an eye toggle in settings. */
  password: string | null;
  loginToken: string;
}

/** Stored form: adds the credentials. Never sent to other players. */
export interface PlayerRecord extends Player {
  /** scrypt hash on the server; "plain:<password>" in offline mode; null = link only. */
  passwordHash: string | null;
  /** Readable copy so the player can see it in their settings. */
  password?: string | null;
  /** Personal sign-in link token. */
  loginToken: string;
}

export interface Session {
  token: string;
  playerId: string;
  createdAt: string;
}

export interface GameRecord {
  id: string;
  playerId: string;
  playerName: string;
  puzzleId: string;
  puzzleTitle: string;
  timeMs: number;
  checks: number;
  reveals: number;
  solvedAt: string;
}

export interface GameInput {
  puzzleId: string;
  timeMs: number;
  checks: number;
  reveals: number;
}

export interface PlayerStats {
  solved: number;
  bestMs: number | null;
  averageMs: number | null;
  totalMs: number;
  cleanSolves: number;
  /** Distinct puzzles solved out of the active library. */
  puzzlesSolved: number;
  puzzlesAvailable: number;
  history: GameRecord[];
}

export interface PuzzleStats extends PuzzleSummary {
  averageMs: number | null;
  bestMs: number | null;
  bestPlayer: string | null;
}

export interface PlayerRow extends Player {
  hasPassword: boolean;
  loginToken: string;
  games: number;
  bestMs: number | null;
  lastPlayed: string | null;
}

export interface AdminOverview {
  /** Pinned puzzle ids per language (absent = rotating). */
  daily: Partial<Record<PuzzleLanguage, string>>;
  /** What each language shows today, pinned or rotated. */
  today: Partial<Record<PuzzleLanguage, string>>;
  players: number;
  games: number;
  puzzles: number;
  activePuzzles: number;
  averageMs: number | null;
  cleanRate: number | null;
  puzzleStats: PuzzleStats[];
  /** Newest first, capped at 200. */
  recentGames: GameRecord[];
  playerRows: PlayerRow[];
  /** Games solved per calendar day, oldest first, last 14 days (zeros included). */
  activity: { date: string; games: number }[];
}

export interface NewPlayer {
  name: string;
  username: string;
  password?: string;
}

export interface PlayerPatch {
  name?: string;
  password?: string | null;
  regenerateToken?: boolean;
}

export interface AuthResult {
  token: string;
  player: Player;
}

/** Machine-readable reasons the client can translate. */
export type ErrorCode = 'bad-credentials' | 'bad-link' | 'sign-in-again' | 'no-puzzles' | 'puzzle-missing' | 'network' | 'invalid' | 'not-found';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: ErrorCode,
  ) {
    super(message);
  }
}

export interface Api {
  mode: 'remote' | 'local';
  auth: {
    login(username: string, password: string): Promise<AuthResult>;
    loginWithToken(loginToken: string): Promise<AuthResult>;
    /** Validate a stored session; rejects with 401 when it is gone. */
    me(token: string): Promise<Player>;
    logout(token: string): Promise<void>;
  };
  /** Active puzzles, optionally only those in one language. */
  listPuzzles(language?: PuzzleLanguage): Promise<PuzzleSummary[]>;
  getPuzzle(id: string): Promise<PuzzleRecord>;
  /** Today's puzzle for the language: the same for every player on a given day. */
  dailyPuzzle(language: PuzzleLanguage): Promise<PuzzleSummary>;
  getMyStats(token: string): Promise<PlayerStats>;
  getMyProfile(token: string): Promise<PlayerProfile>;
  recordGame(token: string, game: GameInput): Promise<GameRecord>;
  admin: {
    /** Email + password sign-in; resolves to an admin session token used as `key` below. */
    login(email: string, password: string): Promise<{ token: string }>;
    /** Sign in through the admin's personal link token. */
    loginWithToken(linkToken: string): Promise<{ token: string }>;
    logout(key: string): Promise<void>;
    overview(key: string): Promise<AdminOverview>;
    addPuzzle(key: string, data: RawCrossword): Promise<PuzzleSummary>;
    setActive(key: string, id: string, active: boolean): Promise<PuzzleSummary>;
    deletePuzzle(key: string, id: string): Promise<void>;
    /** Pin (or unpin with null) today's puzzle for a language. */
    setDaily(key: string, language: PuzzleLanguage, id: string | null): Promise<void>;
    createPlayer(key: string, player: NewPlayer): Promise<PlayerRow>;
    updatePlayer(key: string, id: string, patch: PlayerPatch): Promise<PlayerRow>;
    deletePlayer(key: string, id: string): Promise<void>;
  };
}
