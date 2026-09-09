import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router';
import { BrandMark } from '../components/BrandMark';
import { IconEye, IconEyeOff } from '../components/Icons';
import { TopBar } from '../components/TopBar';
import { describeError, useI18n } from '../i18n';
import { useApi } from '../services/api';
import { useSession } from '../services/session';
import styles from './Login.module.css';
import shared from './pages.module.css';

/**
 * Sign in with a username and password, or automatically through a personal
 * link (`/login?token=…`). There is no self-registration: accounts are
 * created in the admin panel.
 */
export function Login() {
  const api = useApi();
  const i18n = useI18n();
  const { t } = i18n;
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const { player, accept } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const linkToken = params.get('token');
  const [linkState, setLinkState] = useState<'idle' | 'working' | 'failed'>(linkToken ? 'working' : 'idle');

  useEffect(() => {
    document.title = `${t('login.title')} · ${t('app.name')}`;
  }, [t]);

  // Personal link: sign in without typing anything.
  useEffect(() => {
    if (!linkToken) return;
    let cancelled = false;
    api.auth
      .loginWithToken(linkToken)
      .then((result) => {
        if (cancelled) return;
        accept(result);
        navigate('/', { replace: true });
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setLinkState('failed');
        setError(describeError(i18n, caught));
      });
    return () => {
      cancelled = true;
    };
  }, [api, linkToken, accept, navigate, i18n]);

  if (player && !linkToken) {
    const from = (location.state as { from?: string } | null)?.from ?? '/';
    return <Navigate to={from} replace />;
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const username = String(form.get('username') ?? '').trim();
    const password = String(form.get('password') ?? '');
    if (!username || !password) return;
    setBusy(true);
    setError(null);
    try {
      accept(await api.auth.login(username, password));
      navigate('/', { replace: true });
    } catch (caught) {
      setError(describeError(i18n, caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={shared.page}>
      <TopBar />
      <main className={styles.main}>
        <div className={styles.backdrop} aria-hidden="true">
          <div className={styles.pattern} />
        </div>
        <div className={styles.card}>
          <BrandMark size={44} />
          <h1 className={styles.title}>{linkState === 'working' ? t('login.signingIn') : t('login.title')}</h1>
          {linkState === 'working' ? (
            <p className={styles.text}>{t('login.oneMoment')}</p>
          ) : (
            <>
              {linkState === 'failed' && <p className={styles.text}>{t('login.linkFailed')}</p>}
              <form className={styles.form} onSubmit={submit}>
                <label className={styles.label} htmlFor="username">
                  {t('login.username')}
                </label>
                <input id="username" name="username" type="email" className={styles.input} autoComplete="email" autoCapitalize="none" autoFocus required />
                <label className={styles.label} htmlFor="password">
                  {t('login.password')}
                </label>
                <div className={styles.passwordField}>
                  <input id="password" name="password" type={showPassword ? 'text' : 'password'} className={styles.input} autoComplete="current-password" required />
                  <button
                    type="button"
                    className={`btn btn-ghost btn-icon ${styles.eye}`}
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? t('prefs.hidePassword') : t('prefs.showPassword')}
                    title={showPassword ? t('prefs.hidePassword') : t('prefs.showPassword')}
                  >
                    {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                  </button>
                </div>
                {error && (
                  <p className={styles.error} role="alert">
                    {error}
                  </p>
                )}
                <button type="submit" className={`btn btn-primary ${styles.submit}`} disabled={busy}>
                  {busy ? t('login.submitting') : t('login.submit')}
                </button>
              </form>
            </>
          )}
        </div>
        {api.mode === 'local' && <p className={shared.note}>{t('login.offline')}</p>}
      </main>
    </div>
  );
}
