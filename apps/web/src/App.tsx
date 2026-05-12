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

function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function App() {
  return (
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
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/monitoring" element={<MonitoringPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
