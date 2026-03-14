import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { localClient } from '@/api/localClient';
import { Navigate } from 'react-router-dom';
import { formatTime, formatDateStr, getPayrollPeriod } from '../components/timeUtils';
import { downloadCSV } from '../components/ExcelExport';
import PayrollPeriodBadge from '../components/PayrollPeriodBadge';
import { Clock, MapPin, Camera, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function MyTimesheets() {
  const { user } = useAuth();
  const [photoPreview, setPhotoPreview] = useState(null);

  if (!user?.setup_complete) return <Navigate to="/Setup" replace />;

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['my-entries', user.email],
    queryFn: () => localClient.entities.TimesheetEntry.filter({ employee_email: user.email }, '-date', 100),
  });

  const completedEntries = entries.filter((e) => e.status === 'completed');

  // Group by payroll period
  const grouped = completedEntries.reduce((acc, entry) => {
    const period = entry.payroll_period || 'Unknown';
    if (!acc[period]) acc[period] = [];
    acc[period].push(entry);
    return acc;
  }, {});

  const currentPeriod = getPayrollPeriod(new Date().toISOString());

  const handleDownload = () => {
    if (!completedEntries.length) return;
    downloadCSV(completedEntries, `my_timesheet_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <div className="p-4 max-w-lg mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
        <h1 className="text-2xl font-bold text-slate-900">My Timesheets</h1>
        <p className="text-slate-500 text-sm mt-0.5">Your time entries</p>
        </div>
        <Button
          onClick={handleDownload}
          disabled={!completedEntries.length}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          <Download className="w-4 h-4 mr-2" />
          Download
        </Button>
      </div>

      <PayrollPeriodBadge />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
        </div>
      ) : completedEntries.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-100">
          <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 text-sm">No completed entries yet</p>
        </div>
      ) : (
        Object.entries(grouped)
          .sort(([a], [b]) => (a === currentPeriod ? -1 : b === currentPeriod ? 1 : b.localeCompare(a)))
          .map(([period, periodEntries]) => (
            <div key={period}>
              <div className="flex items-center gap-2 mb-3">
                <Badge variant={period === currentPeriod ? 'default' : 'secondary'} className="text-xs">
                  {period.replace(' to ', ' → ')}
                </Badge>
                <span className="text-xs text-slate-400">
                  {periodEntries.reduce((s, e) => s + (e.hours_decimal || 0), 0).toFixed(1)}h total
                </span>
              </div>
              <div className="space-y-2">
                {periodEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="bg-white rounded-xl p-4 border border-slate-100"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-medium text-slate-900 text-sm">
                        {formatDateStr(entry.date)}
                      </p>
                      <span className="text-sm font-bold text-slate-900">{entry.hours_decimal}h</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-[11px] text-slate-500 rounded-lg bg-slate-50 p-2">
                      <div>
                        <p className="uppercase tracking-wide text-slate-400">Loc</p>
                        <p className="font-semibold text-slate-700 flex items-center gap-1"><MapPin className="w-3 h-3" />{entry.data_center_location || 'CLB'}</p>
                      </div>
                      <div>
                        <p className="uppercase tracking-wide text-slate-400">In</p>
                        <p className="font-semibold text-slate-700">{formatTime(entry.time_in)}</p>
                      </div>
                      <div>
                        <p className="uppercase tracking-wide text-slate-400">Out</p>
                        <p className="font-semibold text-slate-700">{formatTime(entry.time_out)}</p>
                      </div>
                      <div>
                        <p className="uppercase tracking-wide text-slate-400">Hours</p>
                        <p className="font-semibold text-slate-700">{entry.hours_decimal || 0}h</p>
                      </div>
                    </div>
                    {(entry.clock_in_photo_url || entry.clock_out_photo_url) && (
                      <div className="flex gap-2 mt-2">
                        {entry.clock_in_photo_url && (
                          <button
                            onClick={() => setPhotoPreview(entry.clock_in_photo_url)}
                            className="flex items-center gap-1 text-[10px] text-blue-600 bg-blue-50 px-2 py-1 rounded-full"
                          >
                            <Camera className="w-3 h-3" /> In
                          </button>
                        )}
                        {entry.clock_out_photo_url && (
                          <button
                            onClick={() => setPhotoPreview(entry.clock_out_photo_url)}
                            className="flex items-center gap-1 text-[10px] text-blue-600 bg-blue-50 px-2 py-1 rounded-full"
                          >
                            <Camera className="w-3 h-3" /> Out
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
      )}

      <Dialog open={!!photoPreview} onOpenChange={() => setPhotoPreview(null)}>
        <DialogContent className="max-w-sm p-2">
          <DialogHeader>
            <DialogTitle>Photo</DialogTitle>
          </DialogHeader>
          {photoPreview && (
            <img src={photoPreview} alt="Clock photo" className="w-full rounded-lg" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}