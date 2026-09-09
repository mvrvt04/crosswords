import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { BrandMark } from './components/BrandMark';
import { I18nProvider } from './i18n';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminDashboard } from './pages/admin/Dashboard';
import { AdminGames } from './pages/admin/Games';
import { AdminPlayers } from './pages/admin/Players';
import { AdminPuzzles } from './pages/admin/Puzzles';
import { History } from './pages/History';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Play } from './pages/Play';
import { Settings } from './pages/Settings';
import { ApiProvider } from './services/api';
import { SessionProvider, useSession } from './services/session';
import styles from './App.module.css';

function Splash() {
  return (
    <div className={styles.splash} aria-busy="true" aria-label="Loading">
      <BrandMark size={44} />
    </div>
  );
}

/** Sends signed-out visitors to the login page, remembering where they were going. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { player } = useSession();
  const location = useLocation();
  if (player === undefined) return <Splash />;
  if (player === null) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

export default function App() {
  return (
    <I18nProvider>
      <ApiProvider fallback={<Splash />}>
        <SessionProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/"
                element={
                  <RequireAuth>
                    <Home />
                  </RequireAuth>
                }
              />
              <Route
                path="/play/:id"
                element={
                  <RequireAuth>
                    <Play />
                  </RequireAuth>
                }
              />
              <Route
                path="/history"
                element={
                  <RequireAuth>
                    <History />
                  </RequireAuth>
                }
              />
              <Route
                path="/settings"
                element={
                  <RequireAuth>
                    <Settings />
                  </RequireAuth>
                }
              />
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="players" element={<AdminPlayers />} />
                <Route path="puzzles" element={<AdminPuzzles />} />
                <Route path="games" element={<AdminGames />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </SessionProvider>
      </ApiProvider>
    </I18nProvider>
  );
}
