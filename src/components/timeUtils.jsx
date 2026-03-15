import { format, differenceInMinutes, endOfMonth } from 'date-fns';

export function calculateHours(timeIn, timeOut) {
  if (!timeIn || !timeOut) return { totalHours: '0:00', hoursDecimal: 0 };
  const diffMin = differenceInMinutes(new Date(timeOut), new Date(timeIn));
  const hours = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  const totalHours = `${hours}:${mins.toString().padStart(2, '0')}`;
  const hoursDecimal = Math.round((diffMin / 60) * 100) / 100;
  return { totalHours, hoursDecimal };
}

export function getPayrollPeriod(dateStr) {
  const date = new Date(dateStr);
  const day = date.getDate();
  const year = date.getFullYear();
  const month = date.getMonth();
  
  if (day <= 15) {
    const start = format(new Date(year, month, 1), 'yyyy-MM-dd');
    const end = format(new Date(year, month, 15), 'yyyy-MM-dd');
    return `${start} to ${end}`;
  } else {
    const start = format(new Date(year, month, 16), 'yyyy-MM-dd');
    const end = format(endOfMonth(new Date(year, month, 1)), 'yyyy-MM-dd');
    return `${start} to ${end}`;
  }
}

export function getWeekRange() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const start = new Date(now);
  start.setDate(now.getDate() - dayOfWeek);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function formatTime(isoString) {
  if (!isoString) return '--:--';
  return format(new Date(isoString), 'hh:mm a');
}

export function formatDateStr(dateStr) {
  if (!dateStr) return '';
  return format(new Date(dateStr), 'MMM dd, yyyy');
}

export function safeHoursDecimal(entry, maxHours = 16) {
  const raw = Number(entry?.hours_decimal);
  if (Number.isFinite(raw) && raw >= 0 && raw <= maxHours) {
    return Math.round(raw * 100) / 100;
  }

  const inTs = new Date(entry?.time_in || '');
  const outTs = new Date(entry?.time_out || '');
  if (Number.isNaN(inTs.getTime()) || Number.isNaN(outTs.getTime())) return 0;

  const diffHours = (outTs.getTime() - inTs.getTime()) / 3600000;
  if (!Number.isFinite(diffHours) || diffHours < 0 || diffHours > maxHours) return 0;
  return Math.round(diffHours * 100) / 100;
}