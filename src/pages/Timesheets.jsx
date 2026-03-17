import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { localClient } from '@/api/localClient';
import { Navigate } from 'react-router-dom';
import { formatTime, formatDateStr, getPayrollPeriod, safeHoursDecimal } from '../components/timeUtils';
import { downloadCSV } from '../components/ExcelExport';
import PayrollPeriodBadge from '../components/PayrollPeriodBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Download, Search, FileSpreadsheet, User, Clock } from 'lucide-react';

function normalizeCompany(value) {
  return String(value || '').trim().toLowerCase();
}

export default function Timesheets() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [periodFilter, setPeriodFilter] = useState(() => getPayrollPeriod(new Date().toISOString()));
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  if (!user?.setup_complete) return <Navigate to="/Setup" replace />;
  if (user.user_role !== 'manager') return <Navigate to="/Dashboard" replace />;

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['all-entries'],
    queryFn: () => localClient.entities.TimesheetEntry.filter({ status: 'completed' }, '-date', 500),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['managed-users', user.email],
    queryFn: () => localClient.entities.User.filter({ manager_email: user.email }),
  });

  const managerCompany = normalizeCompany(user.customer || user.company_name);
  const managedEmployees = employees.filter((employee) => {
    if (!managerCompany) return true;
    return normalizeCompany(employee.customer || employee.company_name) === managerCompany;
  });

  const managedEmails = managedEmployees.map((e) => e.email);
  const managedEntries = entries.filter((e) => managedEmails.includes(e.employee_email));

  const currentPeriod = getPayrollPeriod(new Date().toISOString());
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthLastDay = String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, '0');
  const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${monthLastDay}`;
  const monthEntries = managedEntries.filter((entry) => {
    const date = String(entry.date || '').slice(0, 10);
    return date >= monthStart && date <= monthEnd;
  });
  const monthHours = monthEntries.reduce((sum, entry) => sum + safeHoursDecimal(entry), 0);
  const monthPay = monthEntries.reduce((sum, entry) => sum + safeHoursDecimal(entry) * Number(entry.hourly_rate || 0), 0);

  const filtered = managedEntries.filter((e) => {
    const nameMatch = (e.employee_name || '').toLowerCase().includes(search.toLowerCase());
    const periodMatch = e.payroll_period === periodFilter;
    const date = String(e.date || '').slice(0, 10);
    const dateMatch = (!fromDate || date >= fromDate) && (!toDate || date <= toDate);
    return nameMatch && periodMatch && dateMatch;
  });

  const handleExport = () => {
    const sanitized = filtered.map((entry) => ({
      ...entry,
      hours_decimal: safeHoursDecimal(entry),
    }));
    downloadCSV(sanitized, `timesheet_${periodFilter.replace(/ /g, '_')}.csv`);
  };

  return (
    <div className="p-4 max-w-lg mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Timesheets</h1>
          <p className="text-slate-500 text-sm mt-0.5">{managedEntries.length} total entries</p>
        </div>
        <Button
          onClick={handleExport}
          className="bg-green-600 hover:bg-green-700 text-white"
          disabled={managedEntries.length === 0}
        >
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
      </div>

      <PayrollPeriodBadge value={periodFilter} onChange={setPeriodFilter} />

      <div className="bg-white rounded-2xl p-3 border border-slate-100 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-500">This Month Hours</p>
          <p className="text-lg font-semibold text-slate-900">{monthHours.toFixed(1)}h</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-500">This Month Est. Pay</p>
          <p className="text-lg font-semibold text-slate-900">${monthPay.toFixed(2)}</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name..."
          className="pl-10"
        />
      </div>

      <div className="bg-white rounded-2xl p-3 border border-slate-100 grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-slate-500">From</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs text-slate-500">To</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-100">
          <FileSpreadsheet className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 text-sm">No timesheet entries found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((entry) => (
            <div key={entry.id} className="bg-white rounded-xl p-4 border border-slate-100">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                    <User className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{entry.employee_name}</p>
                    <p className="text-xs text-slate-500">{formatDateStr(entry.date)}</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-slate-900">{safeHoursDecimal(entry)}h</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatTime(entry.time_in)} → {formatTime(entry.time_out)}
                </div>
                <Badge variant="secondary" className="text-[10px]">
                  {entry.data_center_location}
                </Badge>
                <span>${(safeHoursDecimal(entry) * (entry.hourly_rate || 0)).toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}