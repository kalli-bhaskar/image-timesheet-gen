import { Calendar } from 'lucide-react';
import { getPayrollPeriod, formatDateStr } from './timeUtils';

export default function PayrollPeriodBadge() {
  const period = getPayrollPeriod(new Date().toISOString());
  const [start, end] = period.split(' to ');

  return (
    <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-xs font-medium">
      <Calendar className="w-3 h-3" />
      <span>{formatDateStr(start)} – {formatDateStr(end)}</span>
    </div>
  );
}