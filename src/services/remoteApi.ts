import type { RawCrossword } from '../model/types';
import { ApiError, type Api, type ErrorCode } from './types';

/** Talks to the bundled Node server (see server/index.ts). */

interface Options {
  method?: string;
  body?: unknown;
  /** Player session token. */
  token?: string;
  /** Admin key. */
  key?: string;
}

async function request<T>(path: string, { method = 'GET', body, token, key }: Options = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (key) headers['X-Admin-Key'] = key;
  let response: Response;
  try {
    response = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError('Could not reach the server. Check your connection and try again.', 0, 'network');
  }
  if (response.status === 204) return undefined as T;
  const payload = (await response.json().catch(() => ({}))) as { error?: string; code?: ErrorCode } & T;
  if (!response.ok) throw new ApiError(payload.error ?? `Request failed (${response.status}).`, response.status, payload.code);
  return payload;
}

export function createRemoteApi(): Api {
  return {
    mode: 'remote',
    auth: {
      login: (username, password) => request('/auth/login', { method: 'POST', body: { username, password } }),
      loginWithToken: (loginToken) => request('/auth/token', { method: 'POST', body: { loginToken } }),
      me: (token) => request('/auth/me', { token }),
      logout: (token) => request('/auth/logout', { method: 'POST', token }),
    },
    listPuzzles: (language) => request(`/puzzles${language ? `?language=${language}` : ''}`),
    getPuzzle: (id) => request(`/puzzles/${encodeURIComponent(id)}`),
    dailyPuzzle: (language) => request(`/puzzles/daily?language=${language}`),
    getMyStats: (token) => request('/me/stats', { token }),
    getMyProfile: (token) => request('/me', { token }),
    recordGame: (token, game) => request('/games', { method: 'POST', body: game, token }),
    admin: {
      login: (email, password) => request('/admin/login', { method: 'POST', body: { email, password } }),
      loginWithToken: (linkToken) => request('/admin/token', { method: 'POST', body: { linkToken } }),
      logout: (key) => request('/admin/logout', { method: 'POST', key }),
      overview: (key) => request('/admin/overview', { key }),
      addPuzzle: (key, data: RawCrossword) => request('/admin/puzzles', { method: 'POST', body: data, key }),
      setActive: (key, id, active) => request(`/admin/puzzles/${encodeURIComponent(id)}`, { method: 'PATCH', body: { active }, key }),
      deletePuzzle: (key, id) => request(`/admin/puzzles/${encodeURIComponent(id)}`, { method: 'DELETE', key }),
      setDaily: (key, language, id) => request('/admin/daily', { method: 'PUT', body: { language, id }, key }),
      createPlayer: (key, player) => request('/admin/players', { method: 'POST', body: player, key }),
      updatePlayer: (key, id, patch) => request(`/admin/players/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch, key }),
      deletePlayer: (key, id) => request(`/admin/players/${encodeURIComponent(id)}`, { method: 'DELETE', key }),
    },
  };
}

/** True when a server with our API is answering on the same origin. */
export async function detectServer(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const response = await fetch('/api/health', { signal: controller.signal, headers: { Accept: 'application/json' } });
    clearTimeout(timer);
    if (!response.ok) return false;
    const payload = (await response.json()) as { ok?: boolean };
    return payload.ok === true;
  } catch {
    return false;
  }
}
