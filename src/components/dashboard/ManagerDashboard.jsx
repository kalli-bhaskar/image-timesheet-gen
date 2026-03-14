import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { localClient } from '@/api/localClient';
import { getWeekRange } from '../timeUtils';
import EmployeeCard from '../EmployeeCard';
import PayrollPeriodBadge from '../PayrollPeriodBadge';
import { Users, TrendingUp } from 'lucide-react';

export default function ManagerDashboard({ user }) {
  const { data: allUsers = [] } = useQuery({
    queryKey: ['managed-users'],
    queryFn: () => localClient.entities.User.filter({ manager_email: user.email, user_role: 'employee' }),
  });

  const { data: entries = [] } = useQuery({
    queryKey: ['all-entries'],
    queryFn: () => localClient.entities.TimesheetEntry.filter({ status: 'completed' }),
  });

  const { start, end } = getWeekRange();

  const employeeStats = allUsers.map((emp) => {
    const weekEntries = entries.filter(
      (e) =>
        e.employee_email === emp.email &&
        new Date(e.date) >= start &&
        new Date(e.date) <= end
    );
    const totalHours = weekEntries.reduce((sum, e) => sum + (e.hours_decimal || 0), 0);
    const estimatedPay = totalHours * (emp.hourly_rate || 0);
    return { ...emp, totalHours, estimatedPay };
  });

  const totalTeamHours = employeeStats.reduce((s, e) => s + e.totalHours, 0);

  return (
    <div className="p-4 max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-0.5">{user.company_name}</p>
      </div>

      <PayrollPeriodBadge />

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-900 rounded-2xl p-4 text-white">
          <Users className="w-5 h-5 text-blue-400 mb-2" />
          <p className="text-2xl font-bold">{allUsers.length}</p>
          <p className="text-slate-400 text-xs">Employees</p>
        </div>
        <div className="bg-slate-900 rounded-2xl p-4 text-white">
          <TrendingUp className="w-5 h-5 text-green-400 mb-2" />
          <p className="text-2xl font-bold">{totalTeamHours.toFixed(1)}h</p>
          <p className="text-slate-400 text-xs">Team Hours (Week)</p>
        </div>
      </div>

      <div>
        <h2 className="font-semibold text-slate-900 mb-3">Team Members</h2>
        {employeeStats.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-slate-100">
            <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">No employees yet</p>
            <p className="text-slate-400 text-xs mt-1">Add team members from the Team tab</p>
          </div>
        ) : (
          <div className="space-y-3">
            {employeeStats.map((emp) => (
              <EmployeeCard
                key={emp.id}
                name={emp.full_name}
                totalHours={emp.totalHours}
                estimatedPay={emp.estimatedPay}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}