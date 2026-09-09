import { useState } from 'react';
import { ConfirmDialog } from '../../components/dialogs';
import { IconCopy, IconTrash } from '../../components/Icons';
import type { PlayerRow } from '../../services/types';
import { copyText } from '../../utils/share';
import { formatDuration } from '../../utils/time';
import { PageHeader } from './AdminLayout';
import { signInLink, useAdmin } from './context';
import { AddPlayer, PasswordDialog } from './forms';
import styles from '../Admin.module.css';
import shared from '../pages.module.css';

type Pending = { kind: 'delete'; player: PlayerRow } | { kind: 'regenerate'; player: PlayerRow } | null;

export function AdminPlayers() {
  const { api, key, overview, perform, notify, refresh } = useAdmin();
  const [pending, setPending] = useState<Pending>(null);
  const [passwordFor, setPasswordFor] = useState<PlayerRow | null>(null);

  const copyLink = async (player: PlayerRow) => {
    const ok = await copyText(signInLink(player.loginToken));
    notify(ok ? `Copied ${player.name}'s sign-in link.` : 'Could not copy on this browser.', ok ? 'success' : 'error');
  };

  const confirmPending = () => {
    const current = pending;
    setPending(null);
    if (!current) return;
    if (current.kind === 'delete') {
      void perform(() => api.admin.deletePlayer(key, current.player.id), `Removed ${current.player.name}.`);
    } else {
      void perform(() => api.admin.updatePlayer(key, current.player.id, { regenerateToken: true }), `New sign-in link for ${current.player.name}. The old one no longer works.`);
    }
  };

  return (
    <>
      <PageHeader title="Players" description={`${overview.players} ${overview.players === 1 ? 'account' : 'accounts'}. There is no self-registration: you create players here.`} />

      <AddPlayer
        onAdd={async (input) => {
          const row = await api.admin.createPlayer(key, input);
          const ok = await copyText(signInLink(row.loginToken));
          notify(ok ? `Added ${row.name}. Their sign-in link is on your clipboard.` : `Added ${row.name}. Copy their sign-in link from the table.`, 'success');
          await refresh();
        }}
      />

      <div className={`${shared.card} ${styles.tableCard}`}>
        <div className={shared.tableWrap}>
          <table className={shared.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Sign in</th>
                <th className={shared.num}>Games</th>
                <th className={shared.num}>Best</th>
                <th>Last played</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {overview.playerRows.map((player) => (
                <tr key={player.id}>
                  <td className={styles.cellTitle}>{player.name}</td>
                  <td className={shared.muted}>{player.username}</td>
                  <td>
                    <div className={styles.signin}>
                      <button type="button" className="btn" onClick={() => copyLink(player)} title={signInLink(player.loginToken)}>
                        <IconCopy size={14} /> Copy link
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={() => setPasswordFor(player)}>
                        {player.hasPassword ? 'Change password' : 'Set password'}
                      </button>
                    </div>
                  </td>
                  <td className={shared.num}>{player.games}</td>
                  <td className={shared.num}>{player.bestMs === null ? '–' : formatDuration(player.bestMs)}</td>
                  <td className={shared.muted}>{player.lastPlayed ? new Date(player.lastPlayed).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '–'}</td>
                  <td className={styles.rowActions}>
                    <button type="button" className="btn btn-ghost" onClick={() => setPending({ kind: 'regenerate', player })} title="Invalidate the current link and make a new one">
                      New link
                    </button>
                    <button type="button" className="btn btn-ghost btn-icon" onClick={() => setPending({ kind: 'delete', player })} aria-label={`Remove ${player.name}`} title="Remove">
                      <IconTrash size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={pending?.kind === 'delete'}
        title={`Remove ${pending?.kind === 'delete' ? pending.player.name : 'this player'}?`}
        body="They will be signed out everywhere and their link will stop working. Their games stay in the history."
        confirmLabel="Remove"
        danger
        onConfirm={confirmPending}
        onClose={() => setPending(null)}
      />
      <ConfirmDialog
        open={pending?.kind === 'regenerate'}
        title="Make a new sign-in link?"
        body="The link you may have already sent will stop working. Copy the new one from the table afterwards."
        confirmLabel="New link"
        onConfirm={confirmPending}
        onClose={() => setPending(null)}
      />
      <PasswordDialog
        player={passwordFor}
        onClose={() => setPasswordFor(null)}
        onSave={async (password) => {
          const target = passwordFor;
          setPasswordFor(null);
          if (!target) return;
          await perform(
            () => api.admin.updatePlayer(key, target.id, { password }),
            password === null ? `${target.name} can now sign in by link only.` : `Password set for ${target.name}.`,
          );
        }}
      />
    </>
  );
}
