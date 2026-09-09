import { useI18n } from '../i18n';
import type { Settings } from '../state/reducer';
import { formatDuration } from '../utils/time';
import { Dialog } from './Dialog';
import { IconCopy, IconTrophy } from './Icons';
import styles from './dialogs.module.css';

export { Dialog };

// ---------------------------------------------------------------------------

interface CompletionProps {
  open: boolean;
  title: string;
  elapsedMs: number;
  words: number;
  checks: number;
  reveals: number;
  onClose: () => void;
  onShare: () => void;
  onDashboard: () => void;
}

export function CompletionDialog({ open, title, elapsedMs, words, checks, reveals, onClose, onShare, onDashboard }: CompletionProps) {
  const { t, describeDuration } = useI18n();
  const remark =
    checks === 0 && reveals === 0
      ? t('done.clean')
      : reveals === 0
        ? t('done.noPeek', { times: checks === 1 ? t('done.once') : t('done.nTimes', { n: checks }) })
        : t('done.reveals', { reveals: reveals === 1 ? t('done.oneReveal') : t('done.manyReveals', { n: reveals }) });
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        <span className={styles.trophyTitle}>
          <IconTrophy size={20} /> {t('done.title')}
        </span>
      }
      footer={
        <>
          <button type="button" className="btn" onClick={onShare}>
            <IconCopy size={15} /> {t('done.copy')}
          </button>
          <button type="button" className="btn" onClick={onClose}>
            {t('done.stay')}
          </button>
          <button type="button" className="btn btn-primary" onClick={onDashboard} data-autofocus>
            {t('done.dashboard')}
          </button>
        </>
      }
    >
      <p className={styles.lead}>
        {t('done.lead', { title, time: describeDuration(elapsedMs) })} {remark}
      </p>
      <dl className={styles.stats}>
        <div>
          <dt>{t('done.time')}</dt>
          <dd>{formatDuration(elapsedMs)}</dd>
        </div>
        <div>
          <dt>{t('done.words')}</dt>
          <dd>{words}</dd>
        </div>
        <div>
          <dt>{t('done.checks')}</dt>
          <dd>{checks}</dd>
        </div>
        <div>
          <dt>{t('done.revealsLabel')}</dt>
          <dd>{reveals}</dd>
        </div>
      </dl>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------

interface SettingsProps {
  open: boolean;
  settings: Settings;
  onChangeSetting: (key: keyof Settings, value: boolean) => void;
  onOpenShortcuts: () => void;
  onClose: () => void;
}

/** In-game toggles. Language and appearance live on the settings page. */
export function SettingsDialog({ open, settings, onChangeSetting, onOpenShortcuts, onClose }: SettingsProps) {
  const { t } = useI18n();
  return (
    <Dialog open={open} onClose={onClose} title={t('settings.title')}>
      <div className={styles.settings}>
        <Toggle
          label={t('settings.celebrate')}
          description={t('settings.celebrateHint')}
          checked={settings.celebrateWords}
          onChange={(value) => onChangeSetting('celebrateWords', value)}
        />
        <Toggle
          label={t('settings.autoCheck')}
          description={t('settings.autoCheckHint')}
          checked={settings.autoCheck}
          onChange={(value) => onChangeSetting('autoCheck', value)}
        />
        <p className={styles.description}>{t('settings.moreInSettings')}</p>
        <button type="button" className={`btn ${styles.linkButton}`} onClick={onOpenShortcuts}>
          {t('game.shortcuts')}
        </button>
      </div>
    </Dialog>
  );
}

interface ToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

function Toggle({ label, description, checked, onChange }: ToggleProps) {
  return (
    <label className={styles.toggleRow}>
      <span className={styles.toggleText}>
        <span className={styles.fieldLabel}>{label}</span>
        <span className={styles.description}>{description}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={`${styles.switch} ${checked ? styles.switchOn : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className={styles.knob} />
      </button>
    </label>
  );
}

// ---------------------------------------------------------------------------

interface ShortcutsProps {
  open: boolean;
  onClose: () => void;
}

export function ShortcutsDialog({ open, onClose }: ShortcutsProps) {
  const { t } = useI18n();
  const shortcuts: [string[], string][] = [
    [['A', '…', 'Z'], t('shortcuts.type')],
    [['Backspace'], t('shortcuts.backspace')],
    [['Delete'], t('shortcuts.delete')],
    [['←', '→', '↑', '↓'], t('shortcuts.arrows')],
    [['Space'], t('shortcuts.space')],
    [['Tab'], t('shortcuts.tab')],
    [['Shift', 'Tab'], t('shortcuts.shiftTab')],
    [['Enter'], t('shortcuts.enter')],
    [['Home', 'End'], t('shortcuts.homeEnd')],
    [['Ctrl', 'Z'], t('shortcuts.undo')],
    [['Ctrl', 'Shift', 'Z'], t('shortcuts.redo')],
    [['Ctrl', '.'], t('shortcuts.pencil')],
    [['Esc'], t('shortcuts.esc')],
    [['?'], t('shortcuts.help')],
  ];
  return (
    <Dialog open={open} onClose={onClose} title={t('game.shortcuts')}>
      <p className={styles.hint}>{t('shortcuts.hint')}</p>
      <dl className={styles.shortcuts}>
        {shortcuts.map(([keys, description]) => (
          <div key={description} className={styles.shortcut}>
            <dt>
              {keys.map((key, i) => (
                <kbd key={i}>{key}</kbd>
              ))}
            </dt>
            <dd>{description}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------

interface ConfirmProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({ open, title, body, confirmLabel, danger, onConfirm, onClose }: ConfirmProps) {
  const { t } = useI18n();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} data-autofocus>
            {t('confirm.cancel')}
          </button>
          <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <p>{body}</p>
    </Dialog>
  );
}
