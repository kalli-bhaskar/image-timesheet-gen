-- PostgreSQL schema for Vercel deployment (Neon/Supabase/other Postgres)
-- Covers users, manager/employee mapping, location tags, timesheets, and manager rollups.

create extension if not exists "pgcrypto";

create table if not exists location_tags (
  tag varchar(8) primary key,
  county_name text not null,
  data_center_location text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into location_tags (tag, county_name, data_center_location)
values
  ('LCT', 'Fairfield', 'Data Center Location'),
  ('CLB', 'Franklin', 'Data Center Location'),
  ('NBY', 'Licking', 'Data Center Location')
on conflict (tag) do nothing;

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text not null,
  display_name text,
  user_role text not null check (user_role in ('manager', 'employee')),
  setup_complete boolean not null default false,
  manager_id uuid references app_users(id) on delete set null,
  company_name text,
  city_state text,
  customer text,
  classification text,
  hourly_rate numeric(10,2) not null default 0,
  per_diem text,
  accommodation_allowance text,
  stn_accommodation text,
  stn_rental text,
  stn_gas text,
  work_location_tag varchar(8) references location_tags(tag),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_app_users_manager_id on app_users(manager_id);
create index if not exists idx_app_users_role on app_users(user_role);

create table if not exists timesheet_entries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references app_users(id) on delete cascade,
  manager_id uuid references app_users(id) on delete set null,
  shift_date date not null,
  payroll_period text,
  status text not null check (status in ('clocked_in', 'completed', 'rejected')),

  data_center_location varchar(8) references location_tags(tag),
  location_source text,

  time_in timestamptz,
  time_out timestamptz,
  total_hours_text text,
  hours_decimal numeric(8,2) not null default 0,

  clock_in_photo_url text,
  clock_out_photo_url text,
  clock_in_meta jsonb,
  clock_out_meta jsonb,

  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_timesheet_employee_id on timesheet_entries(employee_id);
create index if not exists idx_timesheet_manager_id on timesheet_entries(manager_id);
create index if not exists idx_timesheet_shift_date on timesheet_entries(shift_date);
create index if not exists idx_timesheet_status on timesheet_entries(status);

create or replace view manager_employee_hours as
select
  m.id as manager_id,
  m.email as manager_email,
  e.id as employee_id,
  e.email as employee_email,
  e.full_name as employee_name,
  date_trunc('week', t.shift_date::timestamp) as week_start,
  sum(coalesce(t.hours_decimal, 0)) as total_hours,
  sum(coalesce(t.hours_decimal, 0) * coalesce(e.hourly_rate, 0)) as estimated_pay
from app_users e
left join app_users m on m.id = e.manager_id
left join timesheet_entries t on t.employee_id = e.id and t.status = 'completed'
where e.user_role = 'employee'
group by m.id, m.email, e.id, e.email, e.full_name, date_trunc('week', t.shift_date::timestamp);

-- Common manager query example:
-- select *
-- from manager_employee_hours
-- where manager_email = 'manager@example.com'
-- order by week_start desc, employee_name;
