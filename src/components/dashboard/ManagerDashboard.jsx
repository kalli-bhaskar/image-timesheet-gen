import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { localClient } from '@/api/localClient';
import { getPayrollPeriod, safeHoursDecimal } from '../timeUtils';
import EmployeeCard from '../EmployeeCard';
import PayrollPeriodBadge from '../PayrollPeriodBadge';
import { Users, TrendingUp } from 'lucide-react';

function normalizeCompany(value) {
  return String(value || '').trim().toLowerCase();
}

export default function ManagerDashboard({ user }) {
  const firstName = (user.display_name || user.full_name || '').split(' ')[0] || 'there';

  const [selectedPeriod, setSelectedPeriod] = useState(() => getPayrollPeriod(new Date().toISOString()));

  const { data: allUsers = [] } = useQuery({
    queryKey: ['managed-users'],
    queryFn: () => localClient.entities.User.filter({ manager_email: user.email, user_role: 'employee' }),
  });

  const { data: entries = [] } = useQuery({
    queryKey: ['all-entries'],
    queryFn: () => localClient.entities.TimesheetEntry.filter({ status: 'completed' }),
  });

  const managerCompany = normalizeCompany(user.customer || user.company_name);
  const managedUsers = allUsers.filter((emp) => {
    if (!managerCompany) return true;
    return normalizeCompany(emp.customer || emp.company_name) === managerCompany;
  });

  const [pStart, pEnd] = selectedPeriod.split(' to ');
  const periodStart = new Date(pStart + 'T00:00:00');
  const periodEnd = new Date(pEnd + 'T23:59:59');

  const employeeStats = managedUsers.map((emp) => {
    const weekEntries = entries.filter(
      (e) =>
        e.employee_email === emp.email &&
        new Date(e.date) >= periodStart &&
        new Date(e.date) <= periodEnd
    );
    const totalHours = weekEntries.reduce((sum, e) => sum + safeHoursDecimal(e), 0);
    const estimatedPay = totalHours * (emp.hourly_rate || 0);
    return { ...emp, totalHours, estimatedPay };
  });

  const totalTeamHours = employeeStats.reduce((s, e) => s + e.totalHours, 0);

  return (
    <div className="p-4 max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Hi, {firstName}</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          {user.customer || user.company_name || "Here's your team at a glance"}
        </p>
      </div>

      <PayrollPeriodBadge value={selectedPeriod} onChange={setSelectedPeriod} />

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-900 rounded-2xl p-4 text-white">
          <Users className="w-5 h-5 text-blue-400 mb-2" />
          <p className="text-2xl font-bold">{managedUsers.length}</p>
          <p className="text-slate-400 text-xs">Employees</p>
        </div>
        <div className="bg-slate-900 rounded-2xl p-4 text-white">
          <TrendingUp className="w-5 h-5 text-green-400 mb-2" />
          <p className="text-2xl font-bold">{totalTeamHours.toFixed(1)}h</p>
          <p className="text-slate-400 text-xs">Team Hours (Period)</p>
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