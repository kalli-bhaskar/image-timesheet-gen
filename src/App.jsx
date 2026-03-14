import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import Layout from './components/Layout';
import Setup from './pages/Setup';
import Dashboard from './pages/Dashboard';
import ClockAction from './pages/ClockAction';
import Employees from './pages/Employees';
import MyTimesheets from './pages/MyTimesheets';
import Timesheets from './pages/Timesheets';
import Settings from './pages/Settings';
import Login from './pages/Login';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated, user } = useAuth();

  const HomeRoute = () => {
    if (!isAuthenticated || !user) return <Login />;
    if (!user.setup_complete) return <Navigate to="/Setup" replace />;
    return <Navigate to="/Dashboard" replace />;
  };

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
          <p className="text-slate-500 text-sm mt-3">Loading...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
  }

  return (
    <Routes>
      <Route path="/" element={<HomeRoute />} />
      <Route path="/Setup" element={isAuthenticated ? <Setup /> : <Navigate to="/" replace />} />
      <Route element={isAuthenticated ? <Layout /> : <Navigate to="/" replace />}>
        <Route path="/Dashboard" element={<Dashboard />} />
        <Route path="/ClockAction" element={<ClockAction />} />
        <Route path="/Employees" element={<Employees />} />
        <Route path="/MyTimesheets" element={<MyTimesheets />} />
        <Route path="/Timesheets" element={<Timesheets />} />
        <Route path="/Settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App