import { useState } from 'react';
import { ConfirmDialog } from '../../components/dialogs';
import { IconTrash } from '../../components/Icons';
import type { PuzzleStats } from '../../services/types';
import { formatDuration } from '../../utils/time';
import { PageHeader } from './AdminLayout';
import { languageName, useAdmin } from './context';
import { AddPuzzle } from './forms';
import styles from '../Admin.module.css';
import shared from '../pages.module.css';

export function AdminPuzzles() {
  const { api, key, overview, perform, notify, refresh } = useAdmin();
  const [pendingDelete, setPendingDelete] = useState<PuzzleStats | null>(null);

  const deletePuzzle = () => {
    const puzzle = pendingDelete;
    setPendingDelete(null);
    if (puzzle) void perform(() => api.admin.deletePuzzle(key, puzzle.id), `Deleted ${puzzle.title}.`);
  };

  return (
    <>
      <PageHeader
        title="Puzzles"
        description={`${overview.puzzles} in the library, ${overview.activePuzzles} available to play. Pin one per language to make it today's puzzle; otherwise the library rotates by day.`}
      />

      <AddPuzzle
        onAdd={async (data) => {
          const summary = await api.admin.addPuzzle(key, data);
          notify(`Added ${summary.title} (${languageName(summary.language)}, ${summary.width}×${summary.height}, ${summary.wordCount} words).`, 'success');
          await refresh();
        }}
      />

      <div className={`${shared.card} ${styles.tableCard}`}>
        <div className={shared.tableWrap}>
          <table className={shared.table}>
            <thead>
              <tr>
                <th>Title</th>
                <th>Language</th>
                <th>Size</th>
                <th className={shared.num}>Plays</th>
                <th className={shared.num}>Average</th>
                <th>Best</th>
                <th>Available</th>
                <th>Today</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {overview.puzzleStats.map((puzzle) => {
                const pinned = overview.daily[puzzle.language] === puzzle.id;
                const today = overview.today[puzzle.language] === puzzle.id;
                return (
                  <tr key={puzzle.id} className={puzzle.active ? '' : styles.inactive}>
                    <td>
                      <span className={styles.cellTitle}>{puzzle.title}</span>
                      <span className={shared.muted}> · {puzzle.id}</span>
                    </td>
                    <td className={shared.muted}>{languageName(puzzle.language)}</td>
                    <td className={shared.muted}>
                      {puzzle.width}×{puzzle.height} · {puzzle.wordCount} words
                    </td>
                    <td className={shared.num}>{puzzle.plays}</td>
                    <td className={shared.num}>{puzzle.averageMs === null ? '–' : formatDuration(puzzle.averageMs)}</td>
                    <td>
                      {puzzle.bestMs === null ? (
                        <span className={shared.muted}>–</span>
                      ) : (
                        <>
                          {formatDuration(puzzle.bestMs)} <span className={shared.muted}>by {puzzle.bestPlayer}</span>
                        </>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={puzzle.active}
                        aria-label={`${puzzle.title} available to play`}
                        className={`${styles.switch} ${puzzle.active ? styles.switchOn : ''}`}
                        onClick={() =>
                          perform(
                            () => api.admin.setActive(key, puzzle.id, !puzzle.active),
                            `${puzzle.title} is now ${puzzle.active ? 'hidden from players' : 'available to play'}.`,
                          )
                        }
                      >
                        <span className={styles.knob} />
                      </button>
                    </td>
                    <td>
                      {pinned ? (
                        <button
                          type="button"
                          className={`btn ${styles.pinned}`}
                          onClick={() => perform(() => api.admin.setDaily(key, puzzle.language, null), `${puzzle.title} is no longer pinned; the ${languageName(puzzle.language)} puzzle rotates daily again.`)}
                          title="Pinned as today's puzzle. Click to go back to the daily rotation."
                        >
                          Pinned
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          disabled={!puzzle.active}
                          onClick={() => perform(() => api.admin.setDaily(key, puzzle.language, puzzle.id), `${puzzle.title} is today's ${languageName(puzzle.language)} puzzle until you unpin it.`)}
                          title={today ? "Today's puzzle by rotation. Pin it to keep it." : "Pin as today's puzzle"}
                        >
                          {today ? 'Today · pin' : 'Pin'}
                        </button>
                      )}
                    </td>
                    <td className={styles.rowActions}>
                      <button type="button" className="btn btn-ghost btn-icon" onClick={() => setPendingDelete(puzzle)} aria-label={`Delete ${puzzle.title}`} title="Delete">
                        <IconTrash size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete ${pendingDelete?.title ?? 'this puzzle'}?`}
        body="The crossword is removed from the library. Games already played on it stay in the history."
        confirmLabel="Delete"
        danger
        onConfirm={deletePuzzle}
        onClose={() => setPendingDelete(null)}
      />
    </>
  );
}
