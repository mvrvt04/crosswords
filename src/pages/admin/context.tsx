import { createContext, useContext } from 'react';
import type { Api, AdminOverview } from '../../services/types';

/** What every admin page needs: the data, the key, and a way to run an action and refresh. */
export interface AdminContextValue {
  api: Api;
  key: string;
  overview: AdminOverview;
  refresh: () => Promise<void>;
  /** Run an admin action, toast the outcome, refresh the overview. Resolves to true on success. */
  perform: (action: () => Promise<unknown>, success: string) => Promise<boolean>;
  notify: (message: string, tone?: 'neutral' | 'success' | 'error') => void;
}

export const AdminContext = createContext<AdminContextValue | null>(null);

export function useAdmin(): AdminContextValue {
  const value = useContext(AdminContext);
  if (!value) throw new Error('useAdmin must be used inside the admin layout');
  return value;
}

export const signInLink = (loginToken: string) => `${window.location.origin}/login?token=${encodeURIComponent(loginToken)}`;

export function messageOf(caught: unknown): string {
  if (caught instanceof Error && caught.message) return caught.message;
  return 'Something went wrong.';
}

export const languageName = (language: 'en' | 'it') => (language === 'it' ? 'Italiano' : 'English');
