import { useI18n } from '../i18n';
import { IconBackspace, IconChevronLeft, IconChevronRight, IconPencil, IconSwap, IconUndo } from './Icons';
import styles from './OnScreenKeyboard.module.css';

interface Props {
  pencil: boolean;
  canUndo: boolean;
  onLetter: (letter: string) => void;
  onBackspace: () => void;
  onSwitch: () => void;
  onUndo: () => void;
  onTogglePencil: () => void;
  onPrevious: () => void;
  onNext: () => void;
}

const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

/**
 * Keyboard for touch devices. The system keyboard would cover the clue bar
 * and half the grid; this one is short, sits under the grid and adds the
 * crossword actions a phone has no keys for.
 */
export function OnScreenKeyboard({ pencil, canUndo, onLetter, onBackspace, onSwitch, onUndo, onTogglePencil, onPrevious, onNext }: Props) {
  const { t } = useI18n();
  // pointerdown keeps focus (and the caret) on the grid instead of the button.
  const press = (fn: () => void) => (event: React.PointerEvent) => {
    event.preventDefault();
    fn();
  };

  return (
    <div className={styles.keyboard} role="group" aria-label={t('game.onScreenKeyboard')}>
      <div className={styles.actions}>
        <button type="button" className={styles.action} onPointerDown={press(onPrevious)} aria-label={t('game.previousClue')}>
          <IconChevronLeft size={18} />
        </button>
        <button type="button" className={styles.action} onPointerDown={press(onSwitch)} aria-label={t('dir.switch')}>
          <IconSwap size={16} /> <span>{t('game.keySwitch')}</span>
        </button>
        <button
          type="button"
          className={`${styles.action} ${pencil ? styles.actionOn : ''}`}
          onPointerDown={press(onTogglePencil)}
          aria-pressed={pencil}
          aria-label={t('game.pencil')}
        >
          <IconPencil size={16} /> <span>{t('game.keyPencil')}</span>
        </button>
        <button type="button" className={styles.action} onPointerDown={press(onUndo)} disabled={!canUndo} aria-label={t('game.undo')}>
          <IconUndo size={16} /> <span>{t('game.undo')}</span>
        </button>
        <button type="button" className={styles.action} onPointerDown={press(onNext)} aria-label={t('game.nextClue')}>
          <IconChevronRight size={18} />
        </button>
      </div>
      {ROWS.map((row, index) => (
        <div key={row} className={styles.row}>
          {index === 2 && <span className={styles.spacer} aria-hidden="true" />}
          {[...row].map((letter) => (
            <button key={letter} type="button" className={styles.key} onPointerDown={press(() => onLetter(letter))} aria-label={letter}>
              {letter}
            </button>
          ))}
          {index === 2 && (
            <button type="button" className={`${styles.key} ${styles.wide}`} onPointerDown={press(onBackspace)} aria-label={t('game.backspace')}>
              <IconBackspace size={20} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
