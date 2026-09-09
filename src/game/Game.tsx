import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ClueBar } from '../components/ClueBar';
import { Clues } from '../components/Clues';
import { CompletionDialog, ConfirmDialog, SettingsDialog, ShortcutsDialog } from '../components/dialogs';
import { Grid, type Pulse } from '../components/Grid';
import { Header } from '../components/Header';
import { OnScreenKeyboard } from '../components/OnScreenKeyboard';
import { Toast } from '../components/Toast';
import { useKeyboard } from '../hooks/useKeyboard';
import { useCoarsePointer } from '../hooks/useMediaQuery';
import { useStopwatch } from '../hooks/useStopwatch';
import { useToast } from '../hooks/useToast';
import { useI18n } from '../i18n';
import { isWordFilled } from '../model/navigation';
import type { Puzzle, WordId } from '../model/types';
import { createInitialState, reduce, toSavedGame, type Action, type PuzzleEvent, type PuzzleState, type Scope, type WordRef } from '../state/reducer';
import { derive } from '../state/selectors';
import { clearSession, loadSession, saveSession } from '../state/storage';
import { buildShareText, copyText } from '../utils/share';
import { formatDuration } from '../utils/time';
import styles from './Game.module.css';

type DialogKind = 'settings' | 'shortcuts' | 'completion' | 'confirm-reveal' | 'confirm-reset' | null;

const EMPTY_WORDS = new Set<WordId>();

export interface SolveResult {
  timeMs: number;
  checks: number;
  reveals: number;
}

interface GameProps {
  puzzle: Puzzle;
  puzzleId: string;
  /** Called once, the moment the puzzle is solved. */
  onSolved: (result: SolveResult) => void;
}

export function Game({ puzzle, puzzleId, onSolved }: GameProps) {
  const navigate = useNavigate();
  const i18n = useI18n();
  const { t, tn, wordLabel } = i18n;
  const storageKey = `crossword:${puzzleId}`;
  const [session] = useState(() => loadSession(storageKey));

  const [state, dispatch] = useReducer(
    (current: PuzzleState, action: Action) => reduce(puzzle, current, action),
    session?.game ?? null,
    (saved) => createInitialState(puzzle, saved),
  );
  const derived = useMemo(() => derive(puzzle, state), [puzzle, state]);
  const solved = state.solvedAt !== null;

  const [paused, setPaused] = useState(false);
  const timerRunning = state.started && !paused && !solved;
  const stopwatch = useStopwatch(session?.elapsedMs ?? 0, timerRunning);

  const { toast, show: showToast, dismiss: dismissToast } = useToast();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const touch = useCoarsePointer();

  const inputRef = useRef<HTMLInputElement>(null);
  const focusGrid = useCallback(() => inputRef.current?.focus({ preventScroll: true }), []);
  const resume = useCallback(() => setPaused(false), []);

  /** "1 Across" / "the puzzle" / "this letter in 1 Across", for feedback. */
  const describe = (scope: Scope, word: WordRef | null): string => {
    if (scope === 'puzzle' || !word) return t('feedback.thePuzzle');
    return scope === 'letter' ? t('feedback.thisLetterIn', { word: wordLabel(word) }) : wordLabel(word);
  };

  // ---- Feedback: react to one-shot events from the reducer --------------
  useEffect(() => {
    if (!state.event) return;
    const { seq, payload } = state.event;
    return handleEvent(payload, seq);
    // The event object changes identity exactly once per reducer event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.event]);

  function handleEvent(payload: PuzzleEvent, seq: number): (() => void) | undefined {
    switch (payload.kind) {
      case 'word-solved':
        if (state.settings.celebrateWords) {
          dismissToast();
          setPulse({ seq, cells: payload.wordIds.flatMap((id) => puzzle.wordsById[id].cells) });
        }
        return;
      case 'puzzle-solved': {
        dismissToast();
        setPulse({ seq, cells: puzzle.cells.filter((cell) => !cell.block).map((cell) => cell.id) });
        onSolved({ timeMs: stopwatch.read(), checks: state.stats.checks, reveals: state.stats.reveals });
        const timer = window.setTimeout(() => setDialog('completion'), 900);
        return () => window.clearTimeout(timer);
      }
      case 'puzzle-filled-incorrect':
        showToast({
          message: t('feedback.filledWrong'),
          action: { label: t('game.checkPuzzle'), onClick: () => dispatch({ type: 'check', scope: 'puzzle' }) },
        });
        return;
      case 'checked':
        showToast(checkMessage(payload));
        return;
      case 'revealed': {
        const what = describe(payload.scope, payload.word);
        showToast({
          message: payload.changed === 0 ? t('feedback.alreadyCorrect', { what: capitalise(what) }) : t('feedback.revealed', { what }),
        });
        return;
      }
      case 'cleared':
        showToast({ message: t('feedback.cleared', { what: describe(payload.scope, payload.word) }) });
        return;
      case 'undone':
      case 'redone':
        return;
    }
  }

  function checkMessage(payload: Extract<PuzzleEvent, { kind: 'checked' }>) {
    const { scope, word, checked, wrong } = payload;
    const label = word ? wordLabel(word) : '';
    if (checked === 0) {
      return { message: scope === 'puzzle' ? t('feedback.nothingToCheckPuzzle') : t('feedback.nothingToCheckWord', { word: label }) };
    }
    if (wrong === 0) {
      if (scope === 'letter') return { message: t('feedback.letterCorrect'), tone: 'success' as const };
      if (scope === 'puzzle') return { message: t('feedback.puzzleCorrectSoFar'), tone: 'success' as const };
      const complete = derived.currentWord ? isWordFilled(derived.currentWord, state.letters) : false;
      return { message: complete ? t('feedback.wordCorrect', { word: label }) : t('feedback.wordCorrectSoFar', { word: label }), tone: 'success' as const };
    }
    if (scope === 'letter') return { message: t('feedback.letterWrong'), tone: 'error' as const };
    return {
      message: t(wrong === 1 ? 'feedback.wrongFlagged_one' : 'feedback.wrongFlagged_other', { n: wrong, where: describe(scope, word) }),
      tone: 'error' as const,
    };
  }

  useEffect(() => {
    document.title = `${solved ? `${t('done.title')} · ` : ''}${puzzle.title} · ${t('app.name')}`;
    return () => {
      document.title = t('app.name');
    };
  }, [puzzle.title, solved, t]);

  // ---- Pause when the tab is hidden --------------------------------------
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && timerRunning) setPaused(true);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [timerRunning]);

  // ---- Persistence ---------------------------------------------------------
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });
  const persist = useCallback(() => {
    const current = stateRef.current;
    const { progress } = derive(puzzle, current);
    saveSession(storageKey, toSavedGame(current), stopwatch.read(), {
      solvedWords: progress.solvedWords,
      totalWords: progress.totalWords,
      filledCells: progress.filledCells,
      totalCells: progress.totalCells,
    });
  }, [puzzle, storageKey, stopwatch]);

  useEffect(() => {
    persist();
  }, [persist, state.letters, state.marks, state.pencils, state.stats, state.settings, state.selected, state.direction, state.solvedAt]);

  useEffect(() => {
    const interval = window.setInterval(() => timerRunning && persist(), 5000);
    window.addEventListener('pagehide', persist);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('pagehide', persist);
      persist();
    };
  }, [persist, timerRunning]);

  // ---- Actions -------------------------------------------------------------
  const act = useCallback(
    (action: Action) => {
      setPaused(false);
      dispatch(action);
    },
    [dispatch],
  );

  const onSelectCell = useCallback(
    (cell: number) => {
      // Clicking the selected cell flips direction, but only when the grid is
      // already active. The very first click (or a click after using the
      // toolbar) should simply re-engage the grid, never surprise the player.
      const gridActive = document.activeElement === inputRef.current;
      if (cell !== stateRef.current.selected || gridActive) act({ type: 'select', cell });
      else setPaused(false);
      focusGrid();
    },
    [act, focusGrid],
  );

  const onSelectWord = useCallback(
    (wordId: WordId) => {
      act({ type: 'selectWord', wordId });
      focusGrid();
    },
    [act, focusGrid],
  );

  const onLetter = useCallback((letter: string) => act({ type: 'input', letter }), [act]);
  const onBackspace = useCallback(() => act({ type: 'backspace' }), [act]);
  const openShortcuts = useCallback(() => setDialog('shortcuts'), []);
  const run = (action: Action) => {
    act(action);
    focusGrid();
  };

  useKeyboard({ dispatch, inputRef, onActivity: resume, onShortcuts: openShortcuts });

  const onReveal = (scope: Scope) => {
    if (scope === 'puzzle') setDialog('confirm-reveal');
    else run({ type: 'reveal', scope });
  };

  const onClear = (scope: 'word' | 'puzzle') => {
    if (scope === 'puzzle') setDialog('confirm-reset');
    else run({ type: 'clear', scope });
  };

  const startOver = () => {
    setDialog(null);
    setPulse(null);
    dispatch({ type: 'clear', scope: 'puzzle' });
    stopwatch.reset(0);
    setPaused(false);
    clearSession(storageKey);
    focusGrid();
  };

  const closeDialog = () => {
    setDialog(null);
    focusGrid();
  };

  const shareResult = async () => {
    const text = buildShareText({
      puzzle,
      marks: state.marks,
      headline: t('share.headline', {
        time: formatDuration(stopwatch.elapsedMs),
        checks: tn('count.check', state.stats.checks),
        reveals: tn('count.reveal', state.stats.reveals),
      }),
      url: window.location.origin,
    });
    const ok = await copyText(text);
    showToast(ok ? { message: t('feedback.copied'), tone: 'success' } : { message: t('feedback.copyFailed'), tone: 'error' });
  };

  // ---- Render --------------------------------------------------------------
  const { currentWord, crossingWord, progress } = derived;
  const visibleSolvedWords = state.settings.celebrateWords || solved ? derived.solvedWords : EMPTY_WORDS;
  const currentSolved = currentWord !== null && visibleSolvedWords.has(currentWord.id);
  const showKeyboard = touch && !solved;

  return (
    <div className={`${styles.app} ${showKeyboard ? styles.withKeyboard : ''}`}>
      <Header
        puzzleTitle={puzzle.title}
        progress={progress}
        elapsedMs={stopwatch.elapsedMs}
        paused={paused}
        started={state.started}
        solved={solved}
        hasCurrentWord={currentWord !== null}
        canUndo={state.history.length > 0}
        canRedo={state.future.length > 0}
        pencil={state.pencil}
        onTogglePause={() => setPaused((p) => !p)}
        onUndo={() => run({ type: 'undo' })}
        onRedo={() => run({ type: 'redo' })}
        onTogglePencil={() => run({ type: 'togglePencil' })}
        onCheck={(scope) => run({ type: 'check', scope })}
        onReveal={onReveal}
        onClear={onClear}
        onOpenSettings={() => setDialog('settings')}
        onOpenShortcuts={openShortcuts}
      />

      <main className={styles.main}>
        <section className={styles.play} aria-label={t('game.puzzle')}>
          <ClueBar
            word={currentWord}
            solved={currentSolved}
            canSwitch={crossingWord !== null}
            onPrevious={() => run({ type: 'nextWord', delta: -1, skipFilled: false })}
            onNext={() => run({ type: 'nextWord', delta: 1, skipFilled: false })}
            onSwitch={() => run({ type: 'toggleDirection' })}
          />
          <div className={styles.gridBox}>
            <Grid
              puzzle={puzzle}
              state={state}
              derived={derived}
              solvedWords={visibleSolvedWords}
              paused={paused}
              elapsedMs={stopwatch.elapsedMs}
              pulse={pulse}
              inputRef={inputRef}
              virtualKeyboard={touch}
              onSelect={onSelectCell}
              onResume={() => {
                resume();
                focusGrid();
              }}
              onLetter={onLetter}
              onBackspace={onBackspace}
            />
          </div>
          <p className={styles.hints}>
            <Hints />{' '}
            <button type="button" className={styles.hintLink} onClick={openShortcuts}>
              {t('game.allShortcuts')}
            </button>
          </p>
        </section>

        <aside className={styles.clues} aria-label={t('game.clues')}>
          <Clues
            puzzle={puzzle}
            direction={state.direction}
            currentWordId={currentWord?.id ?? null}
            crossingWordId={crossingWord?.id ?? null}
            solvedWords={visibleSolvedWords}
            onSelect={onSelectWord}
          />
        </aside>
      </main>

      {showKeyboard && (
        <OnScreenKeyboard
          pencil={state.pencil}
          canUndo={state.history.length > 0}
          onLetter={onLetter}
          onBackspace={onBackspace}
          onSwitch={() => act({ type: 'toggleDirection' })}
          onUndo={() => act({ type: 'undo' })}
          onTogglePencil={() => act({ type: 'togglePencil' })}
          onPrevious={() => act({ type: 'nextWord', delta: -1, skipFilled: false })}
          onNext={() => act({ type: 'nextWord', delta: 1, skipFilled: false })}
        />
      )}

      {/* Announce the clue for screen-reader users whenever the word changes. */}
      <div className="visually-hidden" aria-live="polite">
        {currentWord ? `${wordLabel(currentWord)}: ${currentWord.clue} ${currentWord.enumeration}` : ''}
      </div>

      <Toast toast={toast} onDismiss={dismissToast} />

      <CompletionDialog
        open={dialog === 'completion'}
        title={puzzle.title}
        elapsedMs={stopwatch.elapsedMs}
        words={puzzle.words.length}
        checks={state.stats.checks}
        reveals={state.stats.reveals}
        onClose={closeDialog}
        onShare={shareResult}
        onDashboard={() => navigate('/')}
      />
      <SettingsDialog
        open={dialog === 'settings'}
        settings={state.settings}
        onChangeSetting={(key, value) => dispatch({ type: 'setSetting', key, value })}
        onOpenShortcuts={openShortcuts}
        onClose={closeDialog}
      />
      <ShortcutsDialog open={dialog === 'shortcuts'} onClose={closeDialog} />
      <ConfirmDialog
        open={dialog === 'confirm-reveal'}
        title={t('confirm.revealTitle')}
        body={t('confirm.revealBody')}
        confirmLabel={t('confirm.revealAction')}
        danger
        onConfirm={() => {
          setDialog(null);
          run({ type: 'reveal', scope: 'puzzle' });
        }}
        onClose={closeDialog}
      />
      <ConfirmDialog
        open={dialog === 'confirm-reset'}
        title={t('confirm.resetTitle')}
        body={t('confirm.resetBody')}
        confirmLabel={t('confirm.resetAction')}
        danger
        onConfirm={startOver}
        onClose={closeDialog}
      />
    </div>
  );
}

/** The one-line keyboard hint under the grid, with <kbd> keys inside the translated sentence. */
function Hints() {
  const { t } = useI18n();
  const parts = t('game.hints', { tab: ' tab', space: ' space', ctrl: ' ctrl', z: ' z' }).split(' ');
  const keys: Record<string, string> = { tab: 'Tab', space: 'Space', ctrl: 'Ctrl', z: 'Z' };
  return (
    <>
      {parts.map((part, i) => {
        if (i === 0) return part;
        const name = Object.keys(keys).find((key) => part.startsWith(key)) ?? '';
        return (
          <span key={i}>
            <kbd>{keys[name]}</kbd>
            {part.slice(name.length)}
          </span>
        );
      })}
    </>
  );
}

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
