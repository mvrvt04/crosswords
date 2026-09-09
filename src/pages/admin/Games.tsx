import { useMemo, useState } from 'react';
import { IconSearch } from '../../components/Icons';
import { isClean } from '../../services/stats';
import { formatDuration } from '../../utils/time';
import { PageHeader } from './AdminLayout';
import { useAdmin } from './context';
import styles from '../Admin.module.css';
import shared from '../pages.module.css';

export function AdminGames() {
  const { overview } = useAdmin();
  const [query, setQuery] = useState('');

  const games = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return overview.recentGames;
    return overview.recentGames.filter((game) => game.playerName.toLowerCase().includes(needle) || game.puzzleTitle.toLowerCase().includes(needle));
  }, [overview.recentGames, query]);

  return (
    <>
      <PageHeader
        title="Games"
        description={`${overview.games} solved in total. Newest first.`}
        actions={
          <label className={styles.search}>
            <IconSearch size={15} />
            <input type="search" className={styles.searchInput} placeholder="Filter by player or puzzle" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Filter games" />
          </label>
        }
      />

      <div className={`${shared.card} ${styles.tableCard}`}>
        {games.length === 0 ? (
          <p className={styles.emptyRow}>{query ? 'No games match that filter.' : 'Nobody has solved a puzzle yet.'}</p>
        ) : (
          <div className={shared.tableWrap}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Puzzle</th>
                  <th className={shared.num}>Time</th>
                  <th className={shared.num}>Checks</th>
                  <th className={shared.num}>Reveals</th>
                  <th>Result</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {games.map((game) => (
                  <tr key={game.id}>
                    <td className={styles.cellTitle}>{game.playerName}</td>
                    <td>{game.puzzleTitle}</td>
                    <td className={shared.num}>{formatDuration(game.timeMs)}</td>
                    <td className={shared.num}>{game.checks}</td>
                    <td className={shared.num}>{game.reveals}</td>
                    <td>{isClean(game) ? <span className={styles.cleanBadge}>Clean</span> : <span className={shared.muted}>With help</span>}</td>
                    <td className={shared.muted}>{new Date(game.solvedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
