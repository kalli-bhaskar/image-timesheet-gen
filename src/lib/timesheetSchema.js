export const TIMESHEET_TEMPLATE_HEADERS = [
  'Date',
  'Data Center Location',
  'City/State',
  'Customer',
  'Candidate Name',
  'Classification Employee/Subcon',
  'Hourly rate',
  'Per Diem',
  'Accommodation Allowance',
  'Time In',
  'Time Out',
  'Total Hours',
  'Hours in Decimal',
  'STN Accommodation Yes/No',
  'STN Rental Yes/No',
  'STN Gas Yes/No',
  'Comment',
];

export const EMPLOYEE_PROFILE_FIELDS = {
  full_name: 'Candidate Name',
  city_state: 'City/State',
  customer: 'Customer',
  classification: 'Classification Employee/Subcon',
  hourly_rate: 'Hourly rate',
  per_diem: 'Per Diem',
  accommodation_allowance: 'Accommodation Allowance',
  stn_accommodation: 'STN Accommodation Yes/No',
  stn_rental: 'STN Rental Yes/No',
  stn_gas: 'STN Gas Yes/No',
};

export const EMPLOYEE_PROFILE_DEFAULTS = {
  customer: 'N/A',
  classification: 'N/A',
  hourly_rate: 0,
  per_diem: 'N/A',
  accommodation_allowance: 'N/A',
  stn_accommodation: 'N/A',
  stn_rental: 'N/A',
  stn_gas: 'N/A',
};
