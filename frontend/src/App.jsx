import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TaskProvider } from './contexts/TaskContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { TrackingProvider } from './contexts/TrackingContext';
import Login from './pages/Login';
import ProfileSetup from './pages/ProfileSetup';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Tasks from './pages/Tasks';
import Schedule from './pages/Schedule';
import Analytics from './pages/Analytics';
import Integrations from './pages/Integrations';
import Notifications from './pages/Notifications';
import Settings from './pages/Settings';
import Layout from './components/Layout';
import PWAInstallBanner from './components/PWAInstallBanner';


function ProtectedRoute({ children }) {
  const { token, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-[var(--accent-base)] flex items-center justify-center text-white animate-pulse">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </div>
        <p className="text-[var(--text-muted)] text-sm font-medium">Loading TaskPulse...</p>
      </div>
    </div>
  );
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function ProfileRoute({ children }) {
  const { token, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center">
      <p className="text-[var(--text-muted)] text-sm">Loading...</p>
    </div>
  );
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

// Simple placeholder page for routes not yet built
function ComingSoon({ page }) {
  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex flex-col items-center justify-center gap-4">
      <div className="text-6xl mb-2">🚧</div>
      <h2 className="text-2xl font-bold text-[var(--text-main)]">{page}</h2>
      <p className="text-[var(--text-muted)]">This section is coming soon.</p>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <TaskProvider>
          <TrackingProvider>
            <BrowserRouter>
              <Routes>
            <Route element={<Layout />}>
              <Route path="/login" element={<Login />} />
              <Route
                path="/profile-setup"
                element={
                  <ProfileRoute>
                    <ProfileSetup />
                  </ProfileRoute>
                }
              />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/tasks"
                element={
                  <ProtectedRoute>
                    <Tasks />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/schedule"
                element={
                  <ProtectedRoute>
                    <Schedule />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/analytics"
                element={
                  <ProtectedRoute>
                    <Analytics />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/integrations"
                element={
                  <ProtectedRoute>
                    <Integrations />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/notifications"
                element={
                  <ProtectedRoute>
                    <Notifications />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
            </BrowserRouter>
          </TrackingProvider>
        </TaskProvider>
      </AuthProvider>
      <PWAInstallBanner />
    </ThemeProvider>
  );
}
