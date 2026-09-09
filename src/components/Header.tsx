import { Link } from 'react-router';
import { useI18n } from '../i18n';
import type { Scope } from '../state/reducer';
import type { Progress } from '../state/selectors';
import { formatDuration } from '../utils/time';
import { BrandMark } from './BrandMark';
import { IconArrowLeft, IconCheck, IconEraser, IconEye, IconGear, IconHelp, IconPause, IconPencil, IconPlay, IconRedo, IconUndo } from './Icons';
import { Menu } from './Menu';
import styles from './Header.module.css';

interface HeaderProps {
  puzzleTitle: string;
  progress: Progress;
  elapsedMs: number;
  paused: boolean;
  started: boolean;
  solved: boolean;
  hasCurrentWord: boolean;
  canUndo: boolean;
  canRedo: boolean;
  pencil: boolean;
  onTogglePause: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onTogglePencil: () => void;
  onCheck: (scope: Scope) => void;
  onReveal: (scope: Scope) => void;
  onClear: (scope: 'word' | 'puzzle') => void;
  onOpenSettings: () => void;
  onOpenShortcuts: () => void;
}

export function Header(props: HeaderProps) {
  const { t, describeDuration } = useI18n();
  const { puzzleTitle, progress, elapsedMs, paused, started, solved, hasCurrentWord, canUndo, canRedo, pencil } = props;
  const percent = Math.round(progress.fraction * 100);

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link to="/" className={`btn btn-ghost ${styles.back}`} aria-label={t('nav.dashboard')} title={t('game.backHint')}>
          <IconArrowLeft size={17} />
          <span className={styles.backLabel}>{t('done.dashboard')}</span>
        </Link>
        <Link to="/" className={styles.brand} aria-label={t('nav.dashboard')}>
          <BrandMark />
          <div className={styles.titles}>
            <span className={styles.app}>{t('app.name')}</span>
            <h1 className={styles.title} aria-live="polite">
              {puzzleTitle}
              <span className={styles.progressText}>
                {' · '}
                {solved
                  ? t('game.solvedIn', { time: formatDuration(elapsedMs) })
                  : t('game.wordsProgress', { solved: progress.solvedWords, total: progress.totalWords })}
              </span>
            </h1>
          </div>
        </Link>

        <div className={styles.actions}>
          <button
            type="button"
            className={`btn btn-ghost ${styles.timer} ${paused ? styles.timerPaused : ''}`}
            onClick={props.onTogglePause}
            disabled={!started || solved}
            aria-label={t('game.timerAria', { action: paused ? t('game.resume') : t('game.pause'), time: describeDuration(elapsedMs) })}
            title={started ? (paused ? t('game.resume') : t('game.pause')) : t('game.timerStart')}
          >
            {paused ? <IconPlay size={14} /> : <IconPause size={14} />}
            <span className={styles.time}>{formatDuration(elapsedMs)}</span>
          </button>

          <div className={`${styles.group} ${styles.editGroup}`}>
            <button type="button" className="btn btn-ghost btn-icon" onClick={props.onUndo} disabled={!canUndo || solved} aria-label={t('game.undo')} title={`${t('game.undo')} (Ctrl+Z)`}>
              <IconUndo size={17} />
            </button>
            <button type="button" className="btn btn-ghost btn-icon" onClick={props.onRedo} disabled={!canRedo || solved} aria-label={t('game.redo')} title={`${t('game.redo')} (Ctrl+Shift+Z)`}>
              <IconRedo size={17} />
            </button>
            <button
              type="button"
              className={`btn btn-ghost btn-icon ${pencil ? styles.pencilOn : ''}`}
              onClick={props.onTogglePencil}
              disabled={solved}
              aria-pressed={pencil}
              aria-label={t('game.pencil')}
              title={t('game.pencilState', { state: pencil ? t('game.on') : t('game.off') })}
            >
              <IconPencil size={17} />
            </button>
          </div>

          <div className={styles.group}>
            <Menu
              label={t('game.check')}
              compact
              icon={<IconCheck size={15} />}
              disabled={solved}
              items={[
                { label: t('game.checkLetter'), onSelect: () => props.onCheck('letter'), disabled: !hasCurrentWord },
                { label: t('game.checkWord'), onSelect: () => props.onCheck('word'), disabled: !hasCurrentWord },
                { label: t('game.checkPuzzle'), onSelect: () => props.onCheck('puzzle') },
              ]}
            />
            <Menu
              label={t('game.reveal')}
              compact
              icon={<IconEye size={15} />}
              disabled={solved}
              items={[
                { label: t('game.revealLetter'), onSelect: () => props.onReveal('letter'), disabled: !hasCurrentWord },
                { label: t('game.revealWord'), onSelect: () => props.onReveal('word'), disabled: !hasCurrentWord },
                { label: t('game.revealPuzzle'), onSelect: () => props.onReveal('puzzle'), danger: true },
              ]}
            />
            <Menu
              label={t('game.clear')}
              compact
              icon={<IconEraser size={15} />}
              items={[
                { label: t('game.clearWord'), onSelect: () => props.onClear('word'), disabled: !hasCurrentWord || solved },
                { label: t('game.startOver'), onSelect: () => props.onClear('puzzle'), danger: true, disabled: !started },
              ]}
            />
          </div>

          <div className={styles.group}>
            <button type="button" className={`btn btn-ghost btn-icon ${styles.desktopOnly}`} onClick={props.onOpenShortcuts} aria-label={t('game.shortcuts')} title={t('game.shortcutsHint')}>
              <IconHelp size={18} />
            </button>
            <button type="button" className="btn btn-ghost btn-icon" onClick={props.onOpenSettings} aria-label={t('game.settings')} title={t('game.settings')}>
              <IconGear size={18} />
            </button>
          </div>
        </div>
      </div>
      <div className={styles.progress} role="progressbar" aria-label={t('game.progress')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
        <div className={`${styles.progressFill} ${solved ? styles.progressDone : ''}`} style={{ width: `${percent}%` }} />
      </div>
    </header>
  );
}
