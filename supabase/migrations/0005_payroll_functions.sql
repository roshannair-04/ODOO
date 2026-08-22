-- =============================================================================
-- Payroll, derived from the attendance ledger — no re-entering hours or
-- leave. One call generates a draft payslip for every eligible employee for
-- a given month, computing LOP days straight from the same `attendance`
-- rows Phase 2 writes (check-in/out, admin corrections, and leave
-- approval). Nothing here re-collects data that already lives elsewhere:
--
--   working_days = calendar days in the month, minus weekends and holidays
--   lop_days     = absent days + unpaid-leave days + (half days x 0.5)
--   payable_days = working_days - lop_days
--   per_day      = gross / working_days
--   net          = per_day x payable_days - deductions
--
-- A day with no attendance row at all counts as absent (unmarked = absent),
-- same as an explicit 'absent' status. A day with status 'leave' is only
-- counted against LOP if the leave was unpaid — attendance doesn't store a
-- leave_type_id, so we recover it via the note column, which
-- approve_leave_request (0004) always sets to the leave type's name, and
-- leave_types.name is unique, so the join back is unambiguous.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Generate (or regenerate) draft payslips for every active employee who has
-- a salary_structure row, for one calendar month. Set-based rather than a
-- per-employee loop — one insert, one pass over the month's days per
-- eligible employee. Already-finalized payslips for that employee/month are
-- left untouched (the ON CONFLICT ... WHERE guard only updates drafts).
-- ---------------------------------------------------------------------------
create function public.generate_payroll_for_month(p_month integer, p_year integer)
returns setof public.payslips
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month_start date;
  v_month_end date;
  v_working_days numeric;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can generate payroll.';
  end if;
  if p_month < 1 or p_month > 12 then
    raise exception 'Month must be between 1 and 12.';
  end if;

  v_month_start := make_date(p_year, p_month, 1);
  v_month_end := (v_month_start + interval '1 month' - interval '1 day')::date;
  v_working_days := public.count_working_days(v_month_start, v_month_end);

  if v_working_days <= 0 then
    raise exception 'That month has no working days — check the holidays table.';
  end if;

  return query
  with working_day_set as (
    select g.day::date as day
    from generate_series(v_month_start, v_month_end, interval '1 day') as g(day)
    where extract(dow from g.day) not in (0, 6)
      and g.day::date not in (select date from public.holidays)
  ),
  latest_salary as (
    select distinct on (employee_id) employee_id, basic, hra, allowances, deductions
    from public.salary_structure
    where effective_from <= v_month_end
    order by employee_id, effective_from desc
  ),
  eligible_employees as (
    select e.id as employee_id, s.basic, s.hra, s.allowances, s.deductions
    from public.employees e
    join latest_salary s on s.employee_id = e.id
    where e.status = 'active'
  ),
  day_detail as (
    select ee.employee_id, wd.day, a.status as att_status, a.note as att_note
    from eligible_employees ee
    cross join working_day_set wd
    left join public.attendance a on a.employee_id = ee.employee_id and a.date = wd.day
  ),
  lop as (
    select
      employee_id,
      count(*) filter (where att_status is null or att_status = 'absent') as absent_days,
      count(*) filter (where att_status = 'half_day') as half_days,
      count(*) filter (
        where att_status = 'leave'
          and coalesce((select lt.is_paid from public.leave_types lt where lt.name = att_note), true) = false
      ) as unpaid_leave_days
    from day_detail
    group by employee_id
  ),
  computed as (
    select
      ee.employee_id,
      ee.basic + ee.hra + ee.allowances as gross,
      ee.deductions,
      v_working_days as working_days,
      (l.absent_days + l.unpaid_leave_days + l.half_days * 0.5) as lop_days,
      greatest(v_working_days - (l.absent_days + l.unpaid_leave_days + l.half_days * 0.5), 0) as payable_days
    from eligible_employees ee
    join lop l on l.employee_id = ee.employee_id
  )
  insert into public.payslips (
    employee_id, month, year, working_days, payable_days, lop_days, gross, deductions, net, status, generated_by, generated_at
  )
  select
    c.employee_id,
    p_month,
    p_year,
    c.working_days,
    c.payable_days,
    c.lop_days,
    c.gross,
    c.deductions,
    round((c.gross / v_working_days) * c.payable_days - c.deductions, 2),
    'draft',
    public.current_employee_id(),
    now()
  from computed c
  on conflict (employee_id, month, year) do update
    set working_days = excluded.working_days,
        payable_days = excluded.payable_days,
        lop_days = excluded.lop_days,
        gross = excluded.gross,
        deductions = excluded.deductions,
        net = excluded.net,
        generated_by = excluded.generated_by,
        generated_at = excluded.generated_at
    where public.payslips.status = 'draft'
  returning *;
end;
$$;

-- ---------------------------------------------------------------------------
-- Lock every draft payslip for a month so it stops changing if payroll is
-- re-run. One click after review, rather than a finalize button per row.
-- ---------------------------------------------------------------------------
create function public.finalize_payroll_for_month(p_month integer, p_year integer)
returns setof public.payslips
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can finalize payroll.';
  end if;

  return query
  update public.payslips
  set status = 'final'
  where month = p_month and year = p_year and status = 'draft'
  returning *;
end;
$$;

grant execute on function public.generate_payroll_for_month(integer, integer) to authenticated;
grant execute on function public.finalize_payroll_for_month(integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: let the payroll page update live when a generation/finalize run
-- completes, same as attendance and leave already do.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.payslips;
