import React from 'react';
import { TIMESHEET_TEMPLATE_HEADERS } from '@/lib/timesheetSchema';
import { safeHoursDecimal } from './timeUtils';

// Helper to generate CSV that matches the Excel template structure
export function generateTimesheetCSV(entries) {
  const headers = TIMESHEET_TEMPLATE_HEADERS;

  const rows = entries.map((e) => [
    e.date || '',
    e.data_center_location || 'CLB',
    e.city_state || 'N/A',
    e.customer || 'N/A',
    e.employee_name || 'N/A',
    e.classification || 'N/A',
    e.hourly_rate || 0,
    e.per_diem || 'N/A',
    e.accommodation_allowance || 'N/A',
    e.time_in ? new Date(e.time_in).toLocaleTimeString() : '',
    e.time_out ? new Date(e.time_out).toLocaleTimeString() : '',
    e.total_hours || '0:00',
    safeHoursDecimal(e),
    e.stn_accommodation || 'N/A',
    e.stn_rental || 'N/A',
    e.stn_gas || 'N/A',
    e.comment || 'N/A',
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  return csvContent;
}

export function downloadCSV(entries, filename) {
  const csv = generateTimesheetCSV(entries);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || 'timesheet.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}