import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Dialog } from '../../components/dialogs';
import { IconPlus, IconUpload } from '../../components/Icons';
import { parseCrossword } from '../../model/parse';
import type { PuzzleLanguage, RawCrossword } from '../../model/types';
import type { PlayerRow } from '../../services/types';
import { languageName, messageOf } from './context';
import styles from '../Admin.module.css';
import shared from '../pages.module.css';

// ---------------------------------------------------------------------------

interface AddPlayerProps {
  onAdd: (input: { name: string; username: string; password?: string }) => Promise<void>;
}

export function AddPlayer({ onAdd }: AddPlayerProps) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get('name') ?? '').trim();
    const username = String(data.get('username') ?? '').trim();
    const password = String(data.get('password') ?? '');
    if (!name || !username) return;
    setBusy(true);
    setProblem(null);
    try {
      await onAdd({ name, username, password: password || undefined });
      form.reset();
    } catch (caught) {
      setProblem(messageOf(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={`${shared.card} ${styles.addPlayer}`} onSubmit={submit}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="new-name">
          Display name
        </label>
        <input id="new-name" name="name" className={styles.input} placeholder="Matteo Natale" maxLength={40} required />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="new-username">
          Email
        </label>
        <input id="new-username" name="username" type="email" className={styles.input} placeholder="name@company.com" autoCapitalize="none" required />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="new-password">
          Password <span className={shared.muted}>(optional)</span>
        </label>
        <input id="new-password" name="password" type="text" className={styles.input} placeholder="Leave empty for link-only" minLength={6} autoComplete="off" />
      </div>
      <div className={styles.addPlayerActions}>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          <IconPlus size={15} /> {busy ? 'Adding…' : 'Add player'}
        </button>
        <span className={styles.preview}>
          {problem ? <span className={styles.previewBad}>{problem}</span> : 'Every player gets a personal sign-in link. A password is only needed if they prefer typing one.'}
        </span>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------

interface PasswordDialogProps {
  player: PlayerRow | null;
  onClose: () => void;
  onSave: (password: string | null) => Promise<void>;
}

export function PasswordDialog({ player, onClose, onSave }: PasswordDialogProps) {
  const [value, setValue] = useState('');
  useEffect(() => setValue(''), [player]);
  const valid = value.length >= 6;
  return (
    <Dialog
      open={player !== null}
      onClose={onClose}
      title={player ? `Password for ${player.name}` : 'Password'}
      footer={
        <>
          {player?.hasPassword && (
            <button type="button" className="btn btn-danger" onClick={() => onSave(null)}>
              Remove password
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={!valid} onClick={() => onSave(value)}>
            Save
          </button>
        </>
      }
    >
      <label className={styles.label} htmlFor="set-password">
        New password (at least 6 characters)
      </label>
      <input id="set-password" type="text" className={styles.input} value={value} onChange={(event) => setValue(event.target.value)} autoComplete="off" data-autofocus />
      <p className={styles.gateText}>Their sign-in link keeps working as well.</p>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------

interface AddPuzzleProps {
  onAdd: (data: RawCrossword) => Promise<void>;
}

/** Paste or upload the JSON; it is validated with the real parser before it is sent. */
export function AddPuzzle({ onAdd }: AddPuzzleProps) {
  const [text, setText] = useState('');
  const [language, setLanguage] = useState<PuzzleLanguage>('en');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  /** The chosen language wins over whatever the file says. */
  const withLanguage = (): RawCrossword => ({ ...(JSON.parse(text) as RawCrossword), language });

  const preview = (() => {
    if (!text.trim()) return null;
    try {
      const parsed = parseCrossword(withLanguage());
      return { ok: true as const, title: parsed.title, size: `${parsed.width}×${parsed.height}`, words: parsed.words.length };
    } catch (caught) {
      return { ok: false as const, message: caught instanceof SyntaxError ? 'This is not valid JSON.' : messageOf(caught) };
    }
  })();

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const content = await file.text();
    setText(content);
    setProblem(null);
    try {
      const declared = (JSON.parse(content) as RawCrossword).language;
      if (declared === 'en' || declared === 'it') setLanguage(declared);
    } catch {
      // the preview will explain
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!preview?.ok) return;
    setBusy(true);
    setProblem(null);
    try {
      await onAdd(withLanguage());
      setText('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (caught) {
      setProblem(messageOf(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={`${shared.card} ${styles.add}`} onSubmit={submit}>
      <div className={styles.addFields}>
        <label className={styles.label} htmlFor="puzzle-json">
          Crossword JSON
        </label>
        <textarea
          id="puzzle-json"
          className={styles.textarea}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setProblem(null);
          }}
          placeholder={'{ "title": "…", "grid": ["…"], "blocks": "#", "entries": { "across": [], "down": [] } }'}
          spellCheck={false}
          rows={7}
        />
        <div className={styles.addRow}>
          <label className={styles.label} htmlFor="puzzle-language">
            Language
          </label>
          <select id="puzzle-language" className={styles.select} value={language} onChange={(event) => setLanguage(event.target.value as PuzzleLanguage)}>
            <option value="en">English</option>
            <option value="it">Italiano</option>
          </select>
          <label className={`btn ${styles.fileButton}`}>
            <IconUpload size={15} /> Choose a file
            <input ref={fileRef} type="file" accept="application/json,.json" className="visually-hidden" onChange={(event) => onFile(event.target.files?.[0])} />
          </label>
          <span className={styles.preview} aria-live="polite">
            {preview === null && 'Same format as the example crossword: grid, blocks and across/down entries.'}
            {preview?.ok && (
              <span className={styles.previewOk}>
                Looks good: <strong>{preview.title}</strong> ({languageName(language)}), {preview.size}, {preview.words} words.
              </span>
            )}
            {preview && !preview.ok && <span className={styles.previewBad}>{preview.message}</span>}
          </span>
          <button type="submit" className="btn btn-primary" disabled={!preview?.ok || busy}>
            <IconPlus size={15} /> {busy ? 'Adding…' : 'Add to library'}
          </button>
        </div>
        {problem && (
          <p className={styles.gateError} role="alert">
            {problem}
          </p>
        )}
      </div>
    </form>
  );
}
