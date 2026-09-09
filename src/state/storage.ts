import type { SavedGame } from './reducer';

/**
 * Progress is saved to localStorage so an accidental refresh or a closed tab
 * never loses a half-finished puzzle. Everything here is best-effort: storage
 * can be unavailable (private mode, quota) and the game must still work.
 */

const VERSION = 1;

export interface SessionProgress {
  solvedWords: number;
  totalWords: number;
  filledCells: number;
  totalCells: number;
}

export interface SavedSession {
  version: number;
  game: SavedGame;
  elapsedMs: number;
  progress?: SessionProgress;
}

export function loadSession(key: string): SavedSession | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedSession;
    if (parsed.version !== VERSION || !Array.isArray(parsed.game?.letters)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(key: string, game: SavedGame, elapsedMs: number, progress?: SessionProgress): void {
  try {
    const session: SavedSession = { version: VERSION, game, elapsedMs, progress };
    localStorage.setItem(key, JSON.stringify(session));
  } catch {
    // Storage unavailable: play on without persistence.
  }
}

export function clearSession(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
