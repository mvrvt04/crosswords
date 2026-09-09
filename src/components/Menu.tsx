import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { IconChevronDown } from './Icons';
import styles from './Menu.module.css';

export interface MenuItem {
  label: string;
  /** Secondary text, e.g. a keyboard hint or scope. */
  hint?: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface MenuProps {
  label: string;
  icon?: ReactNode;
  items: MenuItem[];
  /** Hide the text label on narrow screens and show only the icon. */
  compact?: boolean;
  /** Always icon-only; the label becomes the accessible name. */
  iconOnly?: boolean;
  disabled?: boolean;
}

/** A small accessible dropdown menu: arrow keys, Home/End, Escape, click-outside. */
export function Menu({ label, icon, items, compact, iconOnly, disabled }: MenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const first = listRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)');
    first?.focus();

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };

  const onListKeyDown = (event: React.KeyboardEvent) => {
    const buttons = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [],
    );
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const focusAt = (i: number) => buttons[(i + buttons.length) % buttons.length]?.focus();

    switch (event.key) {
      case 'ArrowDown':
        focusAt(index + 1);
        break;
      case 'ArrowUp':
        focusAt(index - 1);
        break;
      case 'Home':
        focusAt(0);
        break;
      case 'End':
        focusAt(buttons.length - 1);
        break;
      case 'Escape':
        close();
        break;
      case 'Tab':
        close(false);
        return; // let focus move on naturally
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={`btn ${styles.trigger} ${compact ? styles.compact : ''} ${iconOnly ? styles.iconOnly : ''}`}
        aria-haspopup="menu"
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-controls={id}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            event.stopPropagation();
            setOpen(true);
          }
        }}
      >
        {icon}
        {!iconOnly && <span className={styles.label}>{label}</span>}
        <IconChevronDown size={14} className={styles.chevron} />
      </button>
      {open && (
        <ul id={id} role="menu" aria-label={label} className={styles.list} ref={listRef} onKeyDown={onListKeyDown}>
          {items.map((item) => (
            <li key={item.label} role="none">
              <button
                type="button"
                role="menuitem"
                className={`${styles.item} ${item.danger ? styles.danger : ''}`}
                disabled={item.disabled}
                onClick={() => {
                  close(false);
                  item.onSelect();
                }}
              >
                <span>{item.label}</span>
                {item.hint && <span className={styles.hint}>{item.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
