import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Navigate } from 'react-router-dom';
import ManagerDashboard from '../components/dashboard/ManagerDashboard';
import EmployeeDashboard from '../components/dashboard/EmployeeDashboard';

export default function Dashboard() {
  const { user } = useAuth();

  if (!user?.setup_complete) {
    return <Navigate to="/Setup" replace />;
  }

  if (user.user_role === 'manager') {
    return <ManagerDashboard user={user} />;
  }

  return <EmployeeDashboard user={user} />;
}