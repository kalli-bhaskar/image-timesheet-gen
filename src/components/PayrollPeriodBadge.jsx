import { useMemo } from 'react';
import { Calendar } from 'lucide-react';
import { getPayrollPeriod, formatDateStr, getSecondPeriodStartDay } from './timeUtils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

function pad2(value) {
  return String(value).padStart(2, '0');
}

function buildPayrollPeriods() {
  const now = new Date();
  const secondStart = getSecondPeriodStartDay();
  const firstEnd = secondStart - 1;

  const start = new Date(now.getFullYear(), 0, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);

  const periods = [];
  let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end) {
    const year = cursor.getFullYear();
    const monthIndex = cursor.getMonth();
    const month = pad2(monthIndex + 1);
    const monthLastDay = new Date(year, monthIndex + 1, 0).getDate();

    periods.push(`${year}-${month}-01 to ${year}-${month}-${pad2(firstEnd)}`);
    periods.push(`${year}-${month}-${pad2(secondStart)} to ${year}-${month}-${pad2(monthLastDay)}`);

    cursor = new Date(year, monthIndex + 1, 1);
  }

  return periods.reverse();
}

export default function PayrollPeriodBadge({ value, onChange }) {
  const period = value || getPayrollPeriod(new Date().toISOString());
  const [start, end] = period.split(' to ');
  const options = useMemo(() => buildPayrollPeriods(), []);

  if (!onChange) {
    return (
      <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-xs font-medium">
        <Calendar className="w-3 h-3" />
        <span>{formatDateStr(start)} - {formatDateStr(end)}</span>
      </div>
    );
  }

  return (
    <Select value={period} onValueChange={onChange}>
      <SelectTrigger className="inline-flex w-auto min-w-[240px] items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700">
        <Calendar className="w-3 h-3" />
        <SelectValue>{formatDateStr(start)} - {formatDateStr(end)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((item) => {
          const [itemStart, itemEnd] = item.split(' to ');
          return (
            <SelectItem key={item} value={item}>
              {formatDateStr(itemStart)} - {formatDateStr(itemEnd)}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
