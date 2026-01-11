import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { WebSocketProvider } from '@/context/WebSocketContext';
import { LoginPage } from '@/pages/Login';
import { RegisterPage } from '@/pages/Register';
import { LobbyPage } from '@/pages/Lobby';
import { GamePage } from '@/pages/Game';
import { Layout } from '@/components/Layout';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <WebSocketProvider>{children}</WebSocketProvider>;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout>
              <LobbyPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/room/:id"
        element={
          <ProtectedRoute>
            <GamePage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
