import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useApi } from './api';
import type { AuthResult, Player } from './types';

/**
 * The signed-in player. The session token lives in localStorage and is
 * validated against the server on startup, so a revoked account or a reset
 * database sends the player back to the login page instead of a broken app.
 */

const KEY = 'apollo-crossword:session';

interface Stored {
  token: string;
  player: Player;
}

function readStored(): Stored | null {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Stored) : null;
    return parsed && typeof parsed.token === 'string' && parsed.player ? parsed : null;
  } catch {
    return null;
  }
}

function writeStored(value: Stored | null): void {
  try {
    if (value) localStorage.setItem(KEY, JSON.stringify(value));
    else localStorage.removeItem(KEY);
  } catch {
    // keep the in-memory value
  }
}

interface SessionContextValue {
  /** undefined while the stored session is being validated. */
  player: Player | null | undefined;
  token: string | null;
  accept: (result: AuthResult) => void;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  const [stored, setStored] = useState<Stored | null | undefined>(undefined);

  useEffect(() => {
    const existing = readStored();
    if (!existing) {
      setStored(null);
      return;
    }
    let cancelled = false;
    api.auth
      .me(existing.token)
      .then((player) => {
        if (cancelled) return;
        const fresh = { token: existing.token, player };
        writeStored(fresh);
        setStored(fresh);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const status = (error as { status?: number }).status;
        // Only a definite "no such session" clears it; a network blip keeps the player signed in.
        if (status === 401 || status === 404) {
          writeStored(null);
          setStored(null);
        } else {
          setStored(existing);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  const accept = useCallback((result: AuthResult) => {
    const next = { token: result.token, player: result.player };
    writeStored(next);
    setStored(next);
  }, []);

  const signOut = useCallback(async () => {
    const current = readStored();
    writeStored(null);
    setStored(null);
    if (current) await api.auth.logout(current.token).catch(() => undefined);
  }, [api]);

  const value = useMemo<SessionContextValue>(
    () => ({ player: stored === undefined ? undefined : (stored?.player ?? null), token: stored?.token ?? null, accept, signOut }),
    [stored, accept, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}
