import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { IconArrowLeft, IconEye, IconEyeOff } from '../components/Icons';
import { TopBar } from '../components/TopBar';
import { useTheme } from '../hooks/useTheme';
import { describeError, LANGUAGES, useI18n, type Language } from '../i18n';
import { useApi } from '../services/api';
import { useSession } from '../services/session';
import type { PlayerProfile } from '../services/types';
import styles from './Settings.module.css';
import shared from './pages.module.css';

const THEMES: Array<'light' | 'dark'> = ['light', 'dark'];

/** Account details, language and appearance. Game-specific toggles stay in the game. */
export function Settings() {
  const api = useApi();
  const i18n = useI18n();
  const { t, lang, setLang } = i18n;
  const { player, token, signOut } = useSession();
  const [, setTheme, resolvedTheme] = useTheme();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = `${t('prefs.title')} · ${t('app.name')}`;
  }, [t]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api
      .getMyProfile(token)
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(describeError(i18n, caught));
      });
    return () => {
      cancelled = true;
    };
  }, [api, token, i18n]);

  if (!player) return null;

  return (
    <div className={shared.page}>
      <TopBar
        user={{ name: player.name, onSignOut: () => void signOut() }}
        right={
          <Link to="/" className={`btn btn-ghost ${styles.back}`} aria-label={t('nav.backToDashboard')} title={t('nav.backToDashboard')}>
            <IconArrowLeft size={15} /> <span className={styles.backLabel}>{t('nav.backToDashboard')}</span>
          </Link>
        }
      />
      <main className={`${shared.content} ${styles.main}`}>
        <h1 className={styles.title}>{t('prefs.title')}</h1>

        <section className={`${shared.card} ${styles.section}`} aria-labelledby="profile-heading">
          <h2 id="profile-heading" className={shared.h2}>
            {t('prefs.profile')}
          </h2>
          {error && (
            <p className={shared.error} role="alert">
              {error}
            </p>
          )}
          <dl className={styles.facts}>
            <div>
              <dt>{t('prefs.name')}</dt>
              <dd>{player.name}</dd>
            </div>
            <div>
              <dt>{t('prefs.username')}</dt>
              <dd className={styles.mono}>{player.username}</dd>
            </div>
            <div>
              <dt>{t('prefs.password')}</dt>
              <dd>
                {!profile ? (
                  '…'
                ) : profile.password ? (
                  <span className={styles.secret}>
                    <span className={styles.mono}>{showPassword ? profile.password : '•'.repeat(Math.max(8, profile.password.length))}</span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-pressed={showPassword}
                      aria-label={showPassword ? t('prefs.hidePassword') : t('prefs.showPassword')}
                      title={showPassword ? t('prefs.hidePassword') : t('prefs.showPassword')}
                    >
                      {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                    </button>
                  </span>
                ) : (
                  t('prefs.passwordUnset')
                )}
              </dd>
            </div>
          </dl>
        </section>

        <section className={`${shared.card} ${styles.section}`} aria-labelledby="language-heading">
          <h2 id="language-heading" className={shared.h2}>
            {t('prefs.language')}
          </h2>
          <p className={styles.hint}>{t('prefs.languageHint')}</p>
          <div className={styles.segmented} role="radiogroup" aria-labelledby="language-heading">
            {LANGUAGES.map((option: Language) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={lang === option}
                lang={option}
                className={`${styles.segment} ${lang === option ? styles.segmentActive : ''}`}
                onClick={() => setLang(option)}
              >
                {i18n.languageName(option)}
              </button>
            ))}
          </div>
        </section>

        <section className={`${shared.card} ${styles.section}`} aria-labelledby="appearance-heading">
          <h2 id="appearance-heading" className={shared.h2}>
            {t('prefs.appearance')}
          </h2>
          <div className={styles.segmented} role="radiogroup" aria-labelledby="appearance-heading">
            {THEMES.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={resolvedTheme === option}
                className={`${styles.segment} ${resolvedTheme === option ? styles.segmentActive : ''}`}
                onClick={() => setTheme(option)}
              >
                {t(`prefs.theme.${option}` as const)}
              </button>
            ))}
          </div>
        </section>

        <section className={`${shared.card} ${styles.section} ${styles.signOut}`}>
          <div>
            <h2 className={shared.h2}>{t('prefs.signOut')}</h2>
            <p className={styles.hint}>{t('prefs.signOutHint')}</p>
          </div>
          <button type="button" className="btn" onClick={() => void signOut()}>
            {t('nav.signOut')}
          </button>
        </section>
      </main>
    </div>
  );
}
