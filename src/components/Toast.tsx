import type { Toast as ToastModel } from '../hooks/useToast';
import { useI18n } from '../i18n';
import { IconClose } from './Icons';
import styles from './Toast.module.css';

interface ToastProps {
  toast: ToastModel | null;
  onDismiss: () => void;
}

/** Always mounted so the live region exists before the first message. */
export function Toast({ toast, onDismiss }: ToastProps) {
  const { t } = useI18n();
  return (
    <div className={styles.region} role="status" aria-live="polite">
      {toast && (
        <div key={toast.id} className={`${styles.toast} ${styles[toast.tone]}`}>
          <span className={styles.message}>{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              className={styles.action}
              onClick={() => {
                onDismiss();
                toast.action?.onClick();
              }}
            >
              {toast.action.label}
            </button>
          )}
          <button type="button" className={styles.close} onClick={onDismiss} aria-label={t('toast.dismiss')}>
            <IconClose size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
