import { format, differenceInMinutes, endOfMonth } from 'date-fns';

const DEFAULT_SECOND_PERIOD_START_DAY = 16;
const USER_KEY = 'timetrack_user';

function clampSecondPeriodDay(rawValue) {
  const raw = Number(rawValue);
  if (!Number.isFinite(raw)) return DEFAULT_SECOND_PERIOD_START_DAY;
  const rounded = Math.floor(raw);
  if (rounded < 2 || rounded > 28) return DEFAULT_SECOND_PERIOD_START_DAY;
  return rounded;
}

function getSecondPeriodStartDay() {
  try {
    const stored = localStorage.getItem(USER_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.payroll_second_period_start_day !== undefined && parsed?.payroll_second_period_start_day !== null && parsed?.payroll_second_period_start_day !== '') {
        return clampSecondPeriodDay(parsed.payroll_second_period_start_day);
      }
    }
  } catch {
    // Ignore local storage parse issues and fall back to env/default.
  }

  return clampSecondPeriodDay(import.meta.env.VITE_PAYROLL_SECOND_PERIOD_START_DAY || DEFAULT_SECOND_PERIOD_START_DAY);
}

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

  const secondPeriodStartDay = getSecondPeriodStartDay();
  const firstPeriodEndDay = secondPeriodStartDay - 1;

  if (day <= firstPeriodEndDay) {
    const start = format(new Date(year, month, 1), 'yyyy-MM-dd');
    const end = format(new Date(year, month, firstPeriodEndDay), 'yyyy-MM-dd');
    return `${start} to ${end}`;
  } else {
    const start = format(new Date(year, month, secondPeriodStartDay), 'yyyy-MM-dd');
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

  const raw = String(dateStr).trim();
  const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    // Parse YYYY-MM-DD as a local calendar date to avoid UTC timezone day shifts.
    return format(new Date(year, month - 1, day), 'MMM dd, yyyy');
  }

  return format(new Date(raw), 'MMM dd, yyyy');
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