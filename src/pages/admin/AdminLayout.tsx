import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router';
import { BrandMark } from '../../components/BrandMark';
import { IconDashboard, IconExternal, IconEye, IconEyeOff, IconGridSmall, IconHistory, IconMoon, IconSun, IconUsers } from '../../components/Icons';
import { Toast } from '../../components/Toast';
import { TopBar } from '../../components/TopBar';
import { useTheme } from '../../hooks/useTheme';
import { useToast } from '../../hooks/useToast';
import { useApi } from '../../services/api';
import type { AdminOverview } from '../../services/types';
import { AdminContext, messageOf, type AdminContextValue } from './context';
import loginStyles from '../Login.module.css';
import shared from '../pages.module.css';
import styles from './AdminLayout.module.css';

const SESSION_STORAGE = 'apollo-crossword:admin-session';

function readSession(): string {
  try {
    return localStorage.getItem(SESSION_STORAGE) ?? '';
  } catch {
    return '';
  }
}

function writeSession(token: string): void {
  try {
    if (token) localStorage.setItem(SESSION_STORAGE, token);
    else localStorage.removeItem(SESSION_STORAGE);
  } catch {
    // ignore
  }
}

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: IconDashboard, end: true },
  { to: '/admin/players', label: 'Players', icon: IconUsers },
  { to: '/admin/puzzles', label: 'Puzzles', icon: IconGridSmall },
  { to: '/admin/games', label: 'Games', icon: IconHistory },
];

/**
 * Sign-in gate (email + password, or the admin's personal link), the sidebar
 * and the shared data for every admin page.
 */
export function AdminLayout() {
  const api = useApi();
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [, setTheme, resolvedTheme] = useTheme();
  const { toast, show: showToast, dismiss } = useToast();
  const [session, setSession] = useState(readSession);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [gateError, setGateError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const linkToken = params.get('token');
  const [checking, setChecking] = useState(Boolean(readSession()) || Boolean(linkToken));

  useEffect(() => {
    const page = NAV.find((item) => (item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)));
    document.title = `${page?.label ?? 'Admin'} · Admin · Apollo Crossword`;
  }, [location.pathname]);

  /** Load the overview with a session token and keep it if it works. */
  const open = useCallback(
    async (token: string) => {
      const data = await api.admin.overview(token);
      setOverview(data);
      setSession(token);
      writeSession(token);
      setGateError(null);
    },
    [api],
  );

  // Personal link (/admin?token=…) or a remembered session: sign in silently.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        if (linkToken) {
          const { token } = await api.admin.loginWithToken(linkToken);
          if (cancelled) return;
          await open(token);
          navigate(location.pathname, { replace: true });
          return;
        }
        const remembered = readSession();
        if (remembered) await open(remembered);
      } catch (caught) {
        if (cancelled) return;
        writeSession('');
        setSession('');
        if (linkToken) setGateError(messageOf(caught));
      } finally {
        if (!cancelled) setChecking(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    if (!email || !password) return;
    setBusy(true);
    setGateError(null);
    try {
      const { token } = await api.admin.login(email, password);
      await open(token);
    } catch (caught) {
      setGateError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  };

  const signOut = () => {
    const current = session;
    writeSession('');
    setSession('');
    setOverview(null);
    if (current) api.admin.logout(current).catch(() => undefined);
  };

  const refresh = useCallback(async () => {
    try {
      await open(session);
    } catch (caught) {
      const status = (caught as { status?: number }).status;
      if (status === 401) {
        signOut();
        return;
      }
      showToast({ message: messageOf(caught), tone: 'error' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, open, showToast]);

  const perform: AdminContextValue['perform'] = useCallback(
    async (action, success) => {
      try {
        await action();
        showToast({ message: success, tone: 'success' });
        await refresh();
        return true;
      } catch (caught) {
        showToast({ message: messageOf(caught), tone: 'error' });
        return false;
      }
    },
    [refresh, showToast],
  );

  if (!overview) {
    // Same page design as the player sign-in: dark crossword backdrop, one card.
    return (
      <div className={shared.page}>
        <TopBar />
        <main className={loginStyles.main}>
          <div className={loginStyles.backdrop} aria-hidden="true">
            <div className={loginStyles.pattern} />
          </div>
          <div className={loginStyles.card}>
            <BrandMark size={44} />
            <span className={styles.gateTag}>Admin</span>
            <h1 className={loginStyles.title}>{checking ? 'Signing in…' : 'Sign in to the admin'}</h1>
            {checking ? (
              <p className={loginStyles.text}>One moment.</p>
            ) : (
              <form className={loginStyles.form} onSubmit={signIn}>
                <label className={loginStyles.label} htmlFor="admin-email">
                  Email
                </label>
                <input id="admin-email" name="email" type="email" className={loginStyles.input} autoComplete="username" autoCapitalize="none" autoFocus required />
                <label className={loginStyles.label} htmlFor="admin-password">
                  Password
                </label>
                <div className={loginStyles.passwordField}>
                  <input id="admin-password" name="password" type={showPassword ? 'text' : 'password'} className={loginStyles.input} autoComplete="current-password" required />
                  <button
                    type="button"
                    className={`btn btn-ghost btn-icon ${loginStyles.eye}`}
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                  </button>
                </div>
                {gateError && (
                  <p className={loginStyles.error} role="alert">
                    {gateError}
                  </p>
                )}
                <button type="submit" className={`btn btn-primary ${loginStyles.submit}`} disabled={busy}>
                  {busy ? 'Signing in…' : 'Sign in'}
                </button>
              </form>
            )}
          </div>
          {api.mode === 'local' && <p className={shared.note}>Offline mode: admin@apollo.st / apollo. Data lives in this browser.</p>}
        </main>
      </div>
    );
  }

  const value: AdminContextValue = {
    api,
    key: session,
    overview,
    refresh,
    perform,
    notify: (message, tone = 'neutral') => showToast({ message, tone }),
  };

  return (
    <AdminContext.Provider value={value}>
      <div className={styles.shell}>
        <aside className={styles.sidebar}>
          <div className={styles.brand}>
            <BrandMark size={30} />
            <div className={styles.brandText}>
              <span className={styles.brandName}>Apollo Crossword</span>
              <span className={styles.brandTag}>Admin</span>
            </div>
          </div>

          <nav className={styles.nav} aria-label="Admin sections">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navActive : ''}`}>
                <Icon size={18} />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          <div className={styles.sidebarFooter}>
            <a href="/" target="_blank" rel="noreferrer" className={styles.navItem}>
              <IconExternal size={17} />
              <span>Open the app</span>
            </a>
            <button type="button" className={styles.navItem} onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>
              {resolvedTheme === 'dark' ? <IconSun size={17} /> : <IconMoon size={17} />}
              <span>{resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
            </button>
            <button type="button" className={`${styles.navItem} ${styles.signOut}`} onClick={signOut}>
              <span>Sign out</span>
            </button>
          </div>
        </aside>

        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
      <Toast toast={toast} onDismiss={dismiss} />
    </AdminContext.Provider>
  );
}

/** Page header used by every admin page. */
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <header className={styles.pageHeader}>
      <div>
        <h1 className={styles.pageTitle}>{title}</h1>
        {description && <p className={styles.pageDescription}>{description}</p>}
      </div>
      {actions && <div className={styles.pageActions}>{actions}</div>}
    </header>
  );
}
