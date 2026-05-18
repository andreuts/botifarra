import { Routes, Route, Navigate } from 'react-router';
import { useAuthStore } from './store/authStore.js';
import { LoginPage } from './pages/LoginPage.js';
import { RegisterPage } from './pages/RegisterPage.js';
import { HomePage } from './pages/HomePage.js';
import { GamePage } from './pages/GamePage.js';
import { MatchHistoryPage } from './pages/MatchHistoryPage.js';
import { RankingsPage } from './pages/RankingsPage.js';
import { AdminPage } from './pages/AdminPage.js';
import { MonitoringPage } from './pages/MonitoringPage.js';
import { FriendsPage } from './pages/FriendsPage.js';
import { TournamentsListPage } from './pages/TournamentsListPage.js';
import { TournamentDetailPage } from './pages/TournamentDetailPage.js';
import { NewsPage } from './pages/NewsPage.js';
import { NewsDetailPage } from './pages/NewsDetailPage.js';
import { NewsAdminListPage } from './pages/NewsAdminListPage.js';
import { NewsEditorPage } from './pages/NewsEditorPage.js';
import { AppShell } from './components/AppShell.js';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <HomePage />
          </RequireAuth>
        }
      />
      <Route
        path="/match/:matchId"
        element={
          <RequireAuth>
            <GamePage />
          </RequireAuth>
        }
      />
      <Route
        path="/play"
        element={
          <RequireAuth>
            <GamePage />
          </RequireAuth>
        }
      />
      <Route
        path="/history"
        element={
          <RequireAuth>
            <MatchHistoryPage />
          </RequireAuth>
        }
      />
      <Route
        path="/rankings"
        element={
          <RequireAuth>
            <RankingsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/friends"
        element={
          <RequireAuth>
            <FriendsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/tournaments"
        element={
          <RequireAuth>
            <TournamentsListPage />
          </RequireAuth>
        }
      />
      <Route
        path="/tournaments/:id"
        element={
          <RequireAuth>
            <TournamentDetailPage />
          </RequireAuth>
        }
      />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/monitoring" element={<MonitoringPage />} />
      {/* News — public read, admin write */}
      <Route path="/news" element={<NewsPage />} />
      <Route path="/news/:id" element={<NewsDetailPage />} />
      <Route path="/news/admin" element={<NewsAdminListPage />} />
      <Route path="/news/admin/new" element={<NewsEditorPage />} />
      <Route path="/news/admin/:id/edit" element={<NewsEditorPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </AppShell>
  );
}
