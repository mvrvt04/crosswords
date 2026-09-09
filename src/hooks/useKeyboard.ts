import { useEffect, type RefObject } from 'react';
import type { Action } from '../state/reducer';

interface Options {
  dispatch: (action: Action) => void;
  /** The invisible input that sits on the selected cell. Focus there means "the grid is active". */
  inputRef: RefObject<HTMLInputElement | null>;
  /** Called before any puzzle action from the keyboard (used to resume from pause). */
  onActivity: () => void;
  onShortcuts: () => void;
}

const EDITABLE = 'input, textarea, select, [contenteditable="true"]';

/**
 * Global keyboard handling.
 *
 * Letters, arrows and Backspace work from anywhere on the page (except inside
 * other inputs, menus and dialogs) so a player who just clicked a toolbar
 * button can keep typing. Tab, Enter and Space are only captured while the
 * grid itself is focused, so buttons keep their native behaviour.
 */
export function useKeyboard({ dispatch, inputRef, onActivity, onShortcuts }: Options) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey) return;
      if (document.querySelector('dialog[open]')) return;

      const target = event.target as HTMLElement | null;
      const inGrid = target !== null && target === inputRef.current;
      if (!inGrid && target && (target.matches(EDITABLE) || target.closest('[role="menu"]'))) return;

      const act = (action: Action) => {
        event.preventDefault();
        onActivity();
        dispatch(action);
        if (!inGrid) inputRef.current?.focus({ preventScroll: true });
      };

      const { key } = event;

      // Editor-style combinations; anything else with Ctrl/Cmd stays with the browser.
      if (event.ctrlKey || event.metaKey) {
        const lower = key.toLowerCase();
        if (lower === 'z' && !event.shiftKey) return act({ type: 'undo' });
        if ((lower === 'z' && event.shiftKey) || lower === 'y') return act({ type: 'redo' });
        if (key === '.') return act({ type: 'togglePencil' });
        return;
      }

      if (/^[a-zA-Z]$/.test(key)) return act({ type: 'input', letter: key });

      switch (key) {
        case 'Backspace':
          return act({ type: 'backspace' });
        case 'Delete':
          return act({ type: 'delete' });
        case 'ArrowLeft':
          return act({ type: 'move', dr: 0, dc: -1 });
        case 'ArrowRight':
          return act({ type: 'move', dr: 0, dc: 1 });
        case 'ArrowUp':
          return act({ type: 'move', dr: -1, dc: 0 });
        case 'ArrowDown':
          return act({ type: 'move', dr: 1, dc: 0 });
        case 'Home':
          return act({ type: 'jump', to: 'start' });
        case 'End':
          return act({ type: 'jump', to: 'end' });
        case '?':
          event.preventDefault();
          onShortcuts();
          return;
      }

      if (!inGrid) return;

      switch (key) {
        case 'Tab':
        case 'Enter':
          return act({ type: 'nextWord', delta: event.shiftKey ? -1 : 1 });
        case ' ':
          return act({ type: 'toggleDirection' });
        case 'Escape':
          inputRef.current?.blur();
          return;
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [dispatch, inputRef, onActivity, onShortcuts]);
}
