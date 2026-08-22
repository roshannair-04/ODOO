-- =============================================================================
-- Dayflow HRMS — initial schema
-- Run this once in your Supabase project: Dashboard -> SQL Editor -> New query
-- -> paste this whole file -> Run. See PROJECT_GUIDE.md for the full setup flow.
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type role as enum ('admin', 'employee');
create type employee_status as enum ('active', 'inactive');
create type attendance_status as enum ('present', 'absent', 'half_day', 'leave');
create type attendance_source as enum ('self', 'admin', 'system');
create type leave_request_status as enum ('pending', 'approved', 'rejected', 'cancelled');
create type payslip_status as enum ('draft', 'final');

-- ---------------------------------------------------------------------------
-- Core tables
-- ---------------------------------------------------------------------------

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  head_employee_id uuid,
  created_at timestamptz not null default now()
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  employee_code text not null unique,
  full_name text not null,
  email text not null unique,
  phone text,
  address text,
  photo_url text,
  department_id uuid references public.departments (id) on delete set null,
  designation text,
  date_of_joining date not null default current_date,
  manager_id uuid references public.employees (id) on delete set null,
  role role not null default 'employee',
  status employee_status not null default 'active',
  created_at timestamptz not null default now()
);

alter table public.departments
  add constraint departments_head_fk foreign key (head_employee_id) references public.employees (id) on delete set null;

create table public.salary_structure (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  effective_from date not null default current_date,
  basic numeric(12, 2) not null default 0,
  hra numeric(12, 2) not null default 0,
  allowances numeric(12, 2) not null default 0,
  deductions numeric(12, 2) not null default 0,
  created_by uuid references public.employees (id),
  created_at timestamptz not null default now(),
  unique (employee_id, effective_from)
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  date date not null,
  check_in_at timestamptz,
  check_out_at timestamptz,
  worked_minutes integer,
  status attendance_status not null default 'present',
  source attendance_source not null default 'self',
  note text,
  created_at timestamptz not null default now(),
  unique (employee_id, date)
);

create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  name text not null
);

create table public.leave_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text not null unique,
  is_paid boolean not null default true,
  annual_quota integer not null default 0,
  requires_approval boolean not null default true
);

create table public.leave_balances (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  leave_type_id uuid not null references public.leave_types (id) on delete cascade,
  year integer not null,
  allocated numeric(5, 1) not null default 0,
  used numeric(5, 1) not null default 0,
  pending numeric(5, 1) not null default 0,
  carried_forward numeric(5, 1) not null default 0,
  unique (employee_id, leave_type_id, year)
);

create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  leave_type_id uuid not null references public.leave_types (id),
  start_date date not null,
  end_date date not null,
  is_half_day boolean not null default false,
  days_count numeric(5, 1) not null,
  reason text,
  status leave_request_status not null default 'pending',
  approver_id uuid references public.employees (id),
  approver_comment text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  constraint leave_dates_valid check (end_date >= start_date)
);

create table public.payslips (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  month integer not null check (month between 1 and 12),
  year integer not null,
  working_days numeric(5, 1) not null,
  payable_days numeric(5, 1) not null,
  lop_days numeric(5, 1) not null default 0,
  gross numeric(12, 2) not null,
  deductions numeric(12, 2) not null default 0,
  net numeric(12, 2) not null,
  status payslip_status not null default 'draft',
  generated_by uuid references public.employees (id),
  generated_at timestamptz not null default now(),
  unique (employee_id, month, year)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  type text not null,
  file_url text not null,
  uploaded_by uuid references public.employees (id),
  uploaded_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.employees (id),
  entity text not null,
  entity_id uuid,
  action text not null,
  before jsonb,
  after jsonb,
  at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index idx_employees_department on public.employees (department_id);
create index idx_employees_manager on public.employees (manager_id);
create index idx_attendance_employee_date on public.attendance (employee_id, date desc);
create index idx_leave_requests_employee on public.leave_requests (employee_id, status);
create index idx_leave_requests_status on public.leave_requests (status);
create index idx_payslips_employee on public.payslips (employee_id, year desc, month desc);
create index idx_notifications_employee on public.notifications (employee_id, read_at);
create index idx_audit_log_entity on public.audit_log (entity, entity_id);

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER so RLS policies can call them without recursion)
-- ---------------------------------------------------------------------------

create function public.current_employee_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from public.employees where user_id = auth.uid();
$$;

create function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.employees where user_id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- New-user provisioning: first person to sign up becomes admin, everyone after
-- is an employee. Fires once per auth.users row, right after Supabase Auth
-- creates it (sign-up form data arrives via raw_user_meta_data).
-- ---------------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_role role;
  next_code text;
begin
  if exists (select 1 from public.employees) then
    assigned_role := 'employee';
  else
    assigned_role := 'admin';
  end if;

  next_code := coalesce(
    new.raw_user_meta_data ->> 'employee_code',
    'EMP-' || lpad((floor(random() * 9000) + 1000)::text, 4, '0')
  );

  insert into public.employees (user_id, employee_code, full_name, email, phone, role)
  values (
    new.id,
    next_code,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data ->> 'phone',
    assigned_role
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Guard: employees may update their own row, but only self-service fields.
-- Anything trying to change role/status/employee_code/department/designation/
-- manager on a self-edit gets silently reverted unless the actor is an admin.
-- Defense in depth on top of the RLS policies below.
-- ---------------------------------------------------------------------------

create function public.enforce_employee_self_edit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() is null only for service-role connections (no user JWT 'sub'
  -- claim) — i.e. server-side admin code and the seed script, which already
  -- bypass RLS entirely. Trust those; everyone else must be an admin.
  if public.is_admin() or auth.uid() is null then
    return new;
  end if;

  new.role := old.role;
  new.status := old.status;
  new.employee_code := old.employee_code;
  new.department_id := old.department_id;
  new.designation := old.designation;
  new.manager_id := old.manager_id;
  new.date_of_joining := old.date_of_joining;
  new.user_id := old.user_id;

  return new;
end;
$$;

create trigger before_employee_update
  before update on public.employees
  for each row execute function public.enforce_employee_self_edit();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.departments enable row level security;
alter table public.employees enable row level security;
alter table public.salary_structure enable row level security;
alter table public.attendance enable row level security;
alter table public.holidays enable row level security;
alter table public.leave_types enable row level security;
alter table public.leave_balances enable row level security;
alter table public.leave_requests enable row level security;
alter table public.payslips enable row level security;
alter table public.documents enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_log enable row level security;

-- departments: everyone signed in can read; only admins write
create policy "departments_select_authenticated" on public.departments
  for select to authenticated using (true);
create policy "departments_write_admin" on public.departments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- employees: read own row, or all rows if admin. Update per the trigger above.
create policy "employees_select_self_or_admin" on public.employees
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "employees_update_self_or_admin" on public.employees
  for update to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "employees_insert_admin" on public.employees
  for insert to authenticated with check (public.is_admin());

-- salary_structure: employee reads own, admin reads/writes all
create policy "salary_select_self_or_admin" on public.salary_structure
  for select to authenticated using (
    employee_id = public.current_employee_id() or public.is_admin()
  );
create policy "salary_write_admin" on public.salary_structure
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- attendance: employee reads/inserts/updates own; admin does everything
create policy "attendance_select_self_or_admin" on public.attendance
  for select to authenticated using (
    employee_id = public.current_employee_id() or public.is_admin()
  );
create policy "attendance_insert_self_or_admin" on public.attendance
  for insert to authenticated with check (
    employee_id = public.current_employee_id() or public.is_admin()
  );
create policy "attendance_update_self_or_admin" on public.attendance
  for update to authenticated using (
    employee_id = public.current_employee_id() or public.is_admin()
  );

-- holidays: everyone reads, admin writes
create policy "holidays_select_authenticated" on public.holidays
  for select to authenticated using (true);
create policy "holidays_write_admin" on public.holidays
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- leave_types: everyone reads, admin writes
create policy "leave_types_select_authenticated" on public.leave_types
  for select to authenticated using (true);
create policy "leave_types_write_admin" on public.leave_types
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- leave_balances: employee reads own, admin reads/writes all (writes normally
-- happen through the approve/reject server action using the service-role client)
create policy "leave_balances_select_self_or_admin" on public.leave_balances
  for select to authenticated using (
    employee_id = public.current_employee_id() or public.is_admin()
  );
create policy "leave_balances_write_admin" on public.leave_balances
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- leave_requests: employee reads/creates own, can cancel own while pending; admin all
create policy "leave_requests_select_self_or_admin" on public.leave_requests
  for select to authenticated using (
    employee_id = public.current_employee_id() or public.is_admin()
  );
create policy "leave_requests_insert_self" on public.leave_requests
  for insert to authenticated with check (employee_id = public.current_employee_id());
create policy "leave_requests_update_self_pending_or_admin" on public.leave_requests
  for update to authenticated using (
    (employee_id = public.current_employee_id() and status = 'pending') or public.is_admin()
  );

-- payslips: employee reads own (read-only), admin reads/writes all
create policy "payslips_select_self_or_admin" on public.payslips
  for select to authenticated using (
    employee_id = public.current_employee_id() or public.is_admin()
  );
create policy "payslips_write_admin" on public.payslips
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- documents: employee reads/uploads own, admin all
create policy "documents_select_self_or_admin" on public.documents
  for select to authenticated using (
    employee_id = public.current_employee_id() or public.is_admin()
  );
create policy "documents_insert_self_or_admin" on public.documents
  for insert to authenticated with check (
    employee_id = public.current_employee_id() or public.is_admin()
  );
create policy "documents_delete_self_or_admin" on public.documents
  for delete to authenticated using (
    employee_id = public.current_employee_id() or public.is_admin()
  );

-- notifications: strictly own
create policy "notifications_select_self" on public.notifications
  for select to authenticated using (employee_id = public.current_employee_id());
create policy "notifications_update_self" on public.notifications
  for update to authenticated using (employee_id = public.current_employee_id());

-- audit_log: admin read-only from the client; rows are written server-side
-- via the service-role client, which bypasses RLS entirely
create policy "audit_log_select_admin" on public.audit_log
  for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Seed reference data every install needs regardless of demo seeding
-- ---------------------------------------------------------------------------
insert into public.leave_types (name, code, is_paid, annual_quota, requires_approval) values
  ('Paid Leave', 'PAID', true, 18, true),
  ('Sick Leave', 'SICK', true, 10, true),
  ('Unpaid Leave', 'UNPAID', false, 0, true);
