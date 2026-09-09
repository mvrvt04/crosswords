import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useI18n } from '../i18n';
import { IconClose } from './Icons';
import styles from './Dialog.module.css';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Wider layout for content-heavy dialogs. */
  size?: 'sm' | 'md';
}

/**
 * Thin wrapper over the native <dialog>: the browser gives us the focus trap,
 * Escape handling and inert background for free.
 */
export function Dialog({ open, onClose, title, children, footer, size = 'sm' }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const { t } = useI18n();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // React's autoFocus runs at mount, when the dialog is still closed.
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`${styles.dialog} ${size === 'md' ? styles.md : ''}`}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog element itself.
        if (event.target === ref.current) onClose();
      }}
    >
      <div className={styles.panel}>
        <header className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <button type="button" className={`btn btn-ghost btn-icon ${styles.close}`} onClick={onClose} aria-label={t('dialog.close')}>
            <IconClose />
          </button>
        </header>
        <div className={styles.body}>{children}</div>
        {footer && <footer className={styles.footer}>{footer}</footer>}
      </div>
    </dialog>
  );
}
