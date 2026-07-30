import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import { ThemeProvider } from './context/ThemeContext';
import { useTheme } from './context/useTheme';

// Pages
import Login from './pages/Login';
import AdminDashboard from './pages/admin/Dashboard';
import AdminCompanies from './pages/admin/Companies';
import AdminCompanyDetail from './pages/admin/CompanyDetail';
import AdminReminders from './pages/admin/Reminders';
import CompanyDashboard from './pages/company/Dashboard';
import CompanyDocuments from './pages/company/Documents';
import CompanyReminders from './pages/company/Reminders';
// Show spinner while auth state loads
const PageLoader = () => (
  <div className="page-loader">
    <div className="spinner"></div>
    <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 12 }}>Loading...</p>
  </div>
);

// Only for authenticated + role-checked routes
const ProtectedRoute = ({ children, role }) => {
  const { user, loading, logout } = useAuth();

  useEffect(() => {
    if (user && user.role !== 'admin' && user.role !== 'company') {
      logout();
    }
  }, [user, logout]);

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  
  if (user.role !== 'admin' && user.role !== 'company') {
    return <PageLoader />;
  }

  if (role && user.role !== role) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  }
  return children;
};

// Login page — redirect away if already logged in
const PublicRoute = ({ children }) => {
  const { user, loading, logout } = useAuth();

  useEffect(() => {
    if (user && user.role !== 'admin' && user.role !== 'company') {
      logout();
    }
  }, [user, logout]);

  if (loading) return <PageLoader />;
  if (user) {
    if (user.role !== 'admin' && user.role !== 'company') {
      return <PageLoader />;
    }
    return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  }
  return children;
};

const AppRoutes = () => {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;

  const getRedirectPath = () => {
    if (!user) return '/login';
    if (user.role === 'admin') return '/admin';
    if (user.role === 'company') return '/dashboard';
    return '/login';
  };

  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />

      {/* Admin Routes */}
      <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/companies" element={<ProtectedRoute role="admin"><AdminCompanies /></ProtectedRoute>} />
      <Route path="/admin/companies/:id" element={<ProtectedRoute role="admin"><AdminCompanyDetail /></ProtectedRoute>} />
      <Route path="/admin/reminders" element={<ProtectedRoute role="admin"><AdminReminders /></ProtectedRoute>} />

      {/* Company Routes */}
      <Route path="/dashboard" element={<ProtectedRoute role="company"><CompanyDashboard /></ProtectedRoute>} />
      <Route path="/documents" element={<ProtectedRoute role="company"><CompanyDocuments /></ProtectedRoute>} />
      <Route path="/reminders" element={<ProtectedRoute role="company"><CompanyReminders /></ProtectedRoute>} />

      {/* Root redirect */}
      <Route path="/" element={<Navigate to={getRedirectPath()} replace />} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to={getRedirectPath()} replace />} />
    </Routes>
  );
};

const ThemedToaster = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: isDark ? '#131929' : '#ffffff',
          color: isDark ? '#f1f5f9' : '#0f172a',
          border: isDark ? '1px solid rgba(99,120,255,0.2)' : '1px solid rgba(15,23,42,0.1)',
          borderRadius: '10px',
          fontSize: '14px',
          boxShadow: isDark ? '0 8px 30px rgba(0,0,0,0.4)' : '0 8px 30px rgba(15,23,42,0.12)'
        },
        success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
        error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } }
      }}
    />
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <ThemedToaster />
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
