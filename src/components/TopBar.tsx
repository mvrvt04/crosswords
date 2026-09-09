import { Link, useNavigate } from 'react-router';
import { useI18n } from '../i18n';
import { BrandMark } from './BrandMark';
import { IconGear, IconMoon, IconSun } from './Icons';
import { Menu } from './Menu';
import styles from './TopBar.module.css';

interface TopBarProps {
  right?: React.ReactNode;
  /** Small label after the brand, e.g. "Admin". */
  section?: string;
  /** Gear icon linking to the settings page. */
  settingsLink?: boolean;
  /** Direct theme toggle (used where there is no settings page, e.g. the admin). */
  themeToggle?: { resolved: 'light' | 'dark'; onToggle: () => void };
  /** Language switch (used before sign-in). */
  languageToggle?: boolean;
  /** Signed-in player: shows the account menu (Settings, Sign out). */
  user?: { name: string; onSignOut: () => void };
}

/** Header for the dashboard, login, settings and admin pages (the game has its own toolbar). */
export function TopBar({ right, section, settingsLink, themeToggle, languageToggle, user }: TopBarProps) {
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  return (
    <header className={styles.bar}>
      <div className={styles.inner}>
        <Link to="/" className={styles.brand}>
          <BrandMark />
          <span className={styles.name}>{t('app.name')}</span>
          {section && <span className={styles.section}>{section}</span>}
        </Link>
        <div className={styles.right}>
          {right}
          {languageToggle && (
            <button type="button" className="btn btn-ghost" onClick={() => setLang(lang === 'en' ? 'it' : 'en')} lang={lang === 'en' ? 'it' : 'en'}>
              {lang === 'en' ? t('lang.it') : t('lang.en')}
            </button>
          )}
          {settingsLink && (
            <Link to="/settings" className="btn btn-ghost btn-icon" aria-label={t('nav.settings')} title={t('nav.settings')}>
              <IconGear size={18} />
            </Link>
          )}
          {user && (
            <Menu
              label={user.name}
              iconOnly
              icon={
                <span className={styles.avatar} aria-hidden="true">
                  {initials(user.name)}
                </span>
              }
              items={[
                { label: t('nav.settings'), onSelect: () => navigate('/settings') },
                { label: t('nav.history'), onSelect: () => navigate('/history') },
                { label: t('nav.signOut'), onSelect: user.onSignOut },
              ]}
            />
          )}
          {themeToggle && (
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              onClick={themeToggle.onToggle}
              aria-label={themeToggle.resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={themeToggle.resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {themeToggle.resolved === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

/** "Matteo Natale" -> "MN", "Sara" -> "S". */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
