import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { localClient } from '@/api/localClient';
import { getWeekRange, formatTime, formatDateStr } from '../timeUtils';
import PayrollPeriodBadge from '../PayrollPeriodBadge';
import { Clock, DollarSign, ArrowRight, LogIn, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function EmployeeDashboard({ user }) {
  const firstName = (user.display_name || user.full_name || '').split(' ')[0] || 'there';

  const { data: entries = [] } = useQuery({
    queryKey: ['my-entries', user.email],
    queryFn: () => localClient.entities.TimesheetEntry.filter({ employee_email: user.email }, '-created_date', 50),
  });

  const { start, end } = getWeekRange();
  const weekEntries = entries.filter(
    (e) => new Date(e.date) >= start && new Date(e.date) <= end && e.status === 'completed'
  );

  const totalHours = weekEntries.reduce((sum, e) => sum + (e.hours_decimal || 0), 0);
  const estimatedPay = totalHours * (user.hourly_rate || 0);

  const activeEntry = entries.find((e) => e.status === 'clocked_in');
  const recentCompleted = entries.filter((e) => e.status === 'completed').slice(0, 5);

  return (
    <div className="p-4 max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Hi, {firstName}
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">Here's your week at a glance</p>
      </div>

      <PayrollPeriodBadge />

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-4 text-white">
          <Clock className="w-5 h-5 text-blue-200 mb-2" />
          <p className="text-3xl font-bold">{totalHours.toFixed(1)}</p>
          <p className="text-blue-200 text-xs">Hours This Week</p>
        </div>
        <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-2xl p-4 text-white">
          <DollarSign className="w-5 h-5 text-green-200 mb-2" />
          <p className="text-3xl font-bold">${estimatedPay.toFixed(0)}</p>
          <p className="text-green-200 text-xs">Estimated Pay</p>
        </div>
      </div>

      {activeEntry && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-amber-800 font-semibold text-sm">Currently Clocked In</p>
              <p className="text-amber-600 text-xs mt-0.5">
                Since {formatTime(activeEntry.time_in)}
              </p>
            </div>
            <Link to="/ClockAction">
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white">
                <LogOut className="w-4 h-4 mr-1" />
                Clock Out
              </Button>
            </Link>
          </div>
        </div>
      )}

      <Link to="/ClockAction" className="block">
        <div className="bg-slate-900 rounded-2xl p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center">
              {activeEntry ? (
                <LogOut className="w-6 h-6 text-white" />
              ) : (
                <LogIn className="w-6 h-6 text-white" />
              )}
            </div>
            <div>
              <p className="text-white font-semibold">
                {activeEntry ? 'Clock Out Now' : 'Clock In Now'}
              </p>
              <p className="text-slate-400 text-xs">Choose Camera or Upload</p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-400" />
        </div>
      </Link>

      <div>
        <h2 className="font-semibold text-slate-900 mb-3">Recent Entries</h2>
        {recentCompleted.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-slate-100">
            <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">No entries yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentCompleted.map((entry) => (
              <div
                key={entry.id}
                className="bg-white rounded-xl p-3 border border-slate-100 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {formatDateStr(entry.date)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatTime(entry.time_in)} → {formatTime(entry.time_out)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">{entry.hours_decimal}h</p>
                  <Badge variant="secondary" className="text-[10px]">
                    {entry.data_center_location}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}