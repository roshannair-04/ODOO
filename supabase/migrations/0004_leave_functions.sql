-- =============================================================================
-- Leave <-> Attendance <-> Balance, wired as one transaction.
--
-- This is the spine of the whole app: applying for leave holds a balance,
-- approving it both finalizes the balance AND writes attendance rows for
-- every working day in range — so payroll (a later phase) can derive
-- payable days straight from attendance, never re-entered. Everything here
-- runs as SECURITY DEFINER because it touches leave_balances and attendance
-- across employees, which plain per-table RLS can't express safely — each
-- function does its own authorization check instead.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Working-day counter: calendar days in [d1, d2], excluding weekends and
-- rows in the holidays table. Used consistently for both the day count on
-- a leave request and the attendance rows written when it's approved.
-- ---------------------------------------------------------------------------
create function public.count_working_days(d1 date, d2 date)
returns numeric
language sql
stable
set search_path = public
as $$
  select count(*)::numeric
  from generate_series(d1, d2, interval '1 day') as g(day)
  where extract(dow from g.day) not in (0, 6)
    and g.day::date not in (select date from public.holidays);
$$;

-- ---------------------------------------------------------------------------
-- Apply for leave. Validates balance (for paid types), checks for overlap
-- with an existing pending/approved request, creates the leave_balances row
-- on first use of a paid type, and places a `pending` hold on the balance.
-- ---------------------------------------------------------------------------
create function public.apply_leave_request(
  p_leave_type_id uuid,
  p_start_date date,
  p_end_date date,
  p_is_half_day boolean,
  p_reason text
)
returns public.leave_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee_id uuid;
  v_is_paid boolean;
  v_annual_quota integer;
  v_leave_type_name text;
  v_days numeric;
  v_year integer;
  v_available numeric;
  v_overlap_count integer;
  v_row public.leave_requests;
begin
  v_employee_id := public.current_employee_id();
  if v_employee_id is null then
    raise exception 'You must be signed in as an employee to apply for leave.';
  end if;

  if p_end_date < p_start_date then
    raise exception 'End date cannot be before the start date.';
  end if;

  if p_is_half_day and p_start_date <> p_end_date then
    raise exception 'A half-day request must have the same start and end date.';
  end if;

  select is_paid, annual_quota, name into v_is_paid, v_annual_quota, v_leave_type_name
  from public.leave_types where id = p_leave_type_id;

  if v_leave_type_name is null then
    raise exception 'Unknown leave type.';
  end if;

  if p_is_half_day then
    if public.count_working_days(p_start_date, p_end_date) < 1 then
      raise exception 'That date falls on a weekend or holiday.';
    end if;
    v_days := 0.5;
  else
    v_days := public.count_working_days(p_start_date, p_end_date);
    if v_days <= 0 then
      raise exception 'That date range has no working days in it.';
    end if;
  end if;

  select count(*) into v_overlap_count
  from public.leave_requests
  where employee_id = v_employee_id
    and status in ('pending', 'approved')
    and daterange(start_date, end_date, '[]') && daterange(p_start_date, p_end_date, '[]');

  if v_overlap_count > 0 then
    raise exception 'You already have a leave request that overlaps these dates.';
  end if;

  v_year := extract(year from p_start_date);

  if v_is_paid then
    insert into public.leave_balances (employee_id, leave_type_id, year, allocated, used, pending, carried_forward)
    values (v_employee_id, p_leave_type_id, v_year, v_annual_quota, 0, 0, 0)
    on conflict (employee_id, leave_type_id, year) do nothing;

    select (allocated + carried_forward - used - pending) into v_available
    from public.leave_balances
    where employee_id = v_employee_id and leave_type_id = p_leave_type_id and year = v_year;

    if v_available < v_days then
      raise exception 'Not enough % balance: % day(s) remaining, % requested.', v_leave_type_name, v_available, v_days;
    end if;

    update public.leave_balances
    set pending = pending + v_days
    where employee_id = v_employee_id and leave_type_id = p_leave_type_id and year = v_year;
  end if;

  insert into public.leave_requests (employee_id, leave_type_id, start_date, end_date, is_half_day, days_count, reason, status)
  values (v_employee_id, p_leave_type_id, p_start_date, p_end_date, p_is_half_day, v_days, p_reason, 'pending')
  returning * into v_row;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Approve: finalize the balance (pending -> used) and write an attendance
-- row for every working day in range. Upserts so a pre-existing attendance
-- row for that date (e.g. an earlier check-in before leave was backdated)
-- is overwritten rather than conflicting.
-- ---------------------------------------------------------------------------
create function public.approve_leave_request(p_request_id uuid, p_comment text default null)
returns public.leave_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.leave_requests;
  v_is_paid boolean;
  v_type_name text;
  v_year integer;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can approve leave requests.';
  end if;

  select * into v_req from public.leave_requests where id = p_request_id for update;
  if v_req.id is null then
    raise exception 'Leave request not found.';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'This request has already been decided.';
  end if;

  select is_paid, name into v_is_paid, v_type_name from public.leave_types where id = v_req.leave_type_id;
  v_year := extract(year from v_req.start_date);

  update public.leave_requests
  set status = 'approved',
      approver_id = public.current_employee_id(),
      approver_comment = p_comment,
      decided_at = now()
  where id = p_request_id
  returning * into v_req;

  if v_is_paid then
    update public.leave_balances
    set pending = greatest(pending - v_req.days_count, 0),
        used = used + v_req.days_count
    where employee_id = v_req.employee_id and leave_type_id = v_req.leave_type_id and year = v_year;
  end if;

  insert into public.attendance (employee_id, date, status, source, note)
  select v_req.employee_id, g.day::date, 'leave', 'system', v_type_name
  from generate_series(v_req.start_date, v_req.end_date, interval '1 day') as g(day)
  where extract(dow from g.day) not in (0, 6)
    and g.day::date not in (select date from public.holidays)
  on conflict (employee_id, date) do update
    set status = 'leave', source = 'system', note = excluded.note;

  return v_req;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reject: release the pending hold, no attendance changes.
-- ---------------------------------------------------------------------------
create function public.reject_leave_request(p_request_id uuid, p_comment text default null)
returns public.leave_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.leave_requests;
  v_is_paid boolean;
  v_year integer;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can reject leave requests.';
  end if;

  select * into v_req from public.leave_requests where id = p_request_id for update;
  if v_req.id is null then
    raise exception 'Leave request not found.';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'This request has already been decided.';
  end if;

  select is_paid into v_is_paid from public.leave_types where id = v_req.leave_type_id;
  v_year := extract(year from v_req.start_date);

  update public.leave_requests
  set status = 'rejected',
      approver_id = public.current_employee_id(),
      approver_comment = p_comment,
      decided_at = now()
  where id = p_request_id
  returning * into v_req;

  if v_is_paid then
    update public.leave_balances
    set pending = greatest(pending - v_req.days_count, 0)
    where employee_id = v_req.employee_id and leave_type_id = v_req.leave_type_id and year = v_year;
  end if;

  return v_req;
end;
$$;

-- ---------------------------------------------------------------------------
-- Cancel: employee withdraws their own request while still pending.
-- ---------------------------------------------------------------------------
create function public.cancel_leave_request(p_request_id uuid)
returns public.leave_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.leave_requests;
  v_is_paid boolean;
  v_year integer;
  v_employee_id uuid;
begin
  v_employee_id := public.current_employee_id();

  select * into v_req from public.leave_requests where id = p_request_id for update;
  if v_req.id is null then
    raise exception 'Leave request not found.';
  end if;
  if v_req.employee_id <> v_employee_id and not public.is_admin() then
    raise exception 'You can only cancel your own requests.';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'Only a pending request can be cancelled.';
  end if;

  select is_paid into v_is_paid from public.leave_types where id = v_req.leave_type_id;
  v_year := extract(year from v_req.start_date);

  update public.leave_requests set status = 'cancelled' where id = p_request_id returning * into v_req;

  if v_is_paid then
    update public.leave_balances
    set pending = greatest(pending - v_req.days_count, 0)
    where employee_id = v_req.employee_id and leave_type_id = v_req.leave_type_id and year = v_year;
  end if;

  return v_req;
end;
$$;

grant execute on function public.count_working_days(date, date) to authenticated;
grant execute on function public.apply_leave_request(uuid, date, date, boolean, text) to authenticated;
grant execute on function public.approve_leave_request(uuid, text) to authenticated;
grant execute on function public.reject_leave_request(uuid, text) to authenticated;
grant execute on function public.cancel_leave_request(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: let the leave approval queue and attendance views update live
-- without a manual refresh (Supabase Realtime enforces RLS per-connection).
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.leave_requests;
alter publication supabase_realtime add table public.attendance;
alter publication supabase_realtime add table public.leave_balances;
