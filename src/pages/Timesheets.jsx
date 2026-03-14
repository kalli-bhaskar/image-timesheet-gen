import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { localClient } from '@/api/localClient';
import { Navigate } from 'react-router-dom';
import { formatTime, formatDateStr, getPayrollPeriod } from '../components/timeUtils';
import { downloadCSV } from '../components/ExcelExport';
import PayrollPeriodBadge from '../components/PayrollPeriodBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Download, Search, FileSpreadsheet, User, Clock, Filter } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function Timesheets() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [periodFilter, setPeriodFilter] = useState('all');

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

  const managedEmails = employees.map((e) => e.email);
  const managedEntries = entries.filter((e) => managedEmails.includes(e.employee_email));

  // Get unique payroll periods
  const periods = [...new Set(managedEntries.map((e) => e.payroll_period).filter(Boolean))].sort().reverse();
  const currentPeriod = getPayrollPeriod(new Date().toISOString());

  const filtered = managedEntries.filter((e) => {
    const nameMatch = (e.employee_name || '').toLowerCase().includes(search.toLowerCase());
    const periodMatch = periodFilter === 'all' || e.payroll_period === periodFilter;
    return nameMatch && periodMatch;
  });

  const handleExport = () => {
    const toExport = periodFilter !== 'all' ? filtered : managedEntries;
    const periodLabel = periodFilter !== 'all' ? periodFilter.replace(/ /g, '_') : 'all';
    downloadCSV(toExport, `timesheet_${periodLabel}.csv`);
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

      <PayrollPeriodBadge />

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name..."
            className="pl-10"
          />
        </div>
        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="w-36">
            <Filter className="w-3 h-3 mr-1" />
            <SelectValue placeholder="Period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Periods</SelectItem>
            {periods.map((p) => (
              <SelectItem key={p} value={p}>
                {p === currentPeriod ? 'Current' : p.split(' to ')[0]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
                <span className="text-sm font-bold text-slate-900">{entry.hours_decimal}h</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatTime(entry.time_in)} → {formatTime(entry.time_out)}
                </div>
                <Badge variant="secondary" className="text-[10px]">
                  {entry.data_center_location}
                </Badge>
                <span>${((entry.hours_decimal || 0) * (entry.hourly_rate || 0)).toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}