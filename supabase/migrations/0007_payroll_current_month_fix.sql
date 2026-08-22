-- =============================================================================
-- Fix: generate_payroll_for_month walked every calendar day through the end
-- of the month regardless of whether the month had actually happened yet.
-- Generating a draft for the CURRENT (in-progress) month therefore counted
-- every remaining day — days that simply haven't occurred, so no attendance
-- row exists for them yet — as an unmarked absence. That inflated LOP days
-- for every employee's current-month draft, and for anyone who joined very
-- recently (all of whose working days this month are still in the future),
-- it produced a payslip with payable_days = 0 and a *negative* net pay,
-- since fixed deductions were still subtracted from zero earnings.
--
-- Fix: cap the day-walk (and the working-days count) at
-- least(month_end, current_date) instead of always month_end. For a fully
-- elapsed past month this changes nothing (today is always past month_end
-- there). For the current month it correctly reflects "days elapsed so
-- far" — an employee who joined today with zero elapsed working days gets
-- no payslip at all this month, rather than one built entirely out of days
-- that haven't happened. Net pay is also floored at 0 as a defensive
-- backstop — a payslip should never show the employee owing the company
-- money, whatever the edge case.
-- =============================================================================

create or replace function public.generate_payroll_for_month(p_month integer, p_year integer)
returns setof public.payslips
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month_start date;
  v_month_end date;
  v_cutoff date;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can generate payroll.';
  end if;
  if p_month < 1 or p_month > 12 then
    raise exception 'Month must be between 1 and 12.';
  end if;

  v_month_start := make_date(p_year, p_month, 1);
  v_month_end := (v_month_start + interval '1 month' - interval '1 day')::date;
  v_cutoff := least(v_month_end, current_date);

  if public.count_working_days(v_month_start, v_month_end) <= 0 then
    raise exception 'That month has no working days — check the holidays table.';
  end if;

  return query
  with latest_salary as (
    select distinct on (employee_id) employee_id, basic, hra, allowances, deductions
    from public.salary_structure
    where effective_from <= v_month_end
    order by employee_id, effective_from desc
  ),
  eligible_employees as (
    select
      e.id as employee_id,
      s.basic, s.hra, s.allowances, s.deductions,
      greatest(v_month_start, e.date_of_joining) as effective_start,
      public.count_working_days(greatest(v_month_start, e.date_of_joining), v_cutoff) as working_days
    from public.employees e
    join latest_salary s on s.employee_id = e.id
    where e.status = 'active'
      and e.date_of_joining <= v_cutoff
  ),
  day_detail as (
    select ee.employee_id, g.day::date as day, a.status as att_status, a.note as att_note
    from eligible_employees ee
    cross join lateral generate_series(ee.effective_start, v_cutoff, interval '1 day') as g(day)
    left join public.attendance a on a.employee_id = ee.employee_id and a.date = g.day::date
    where ee.working_days > 0
      and extract(dow from g.day) not in (0, 6)
      and g.day::date not in (select date from public.holidays)
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
      ee.working_days,
      (l.absent_days + l.unpaid_leave_days + l.half_days * 0.5) as lop_days,
      greatest(ee.working_days - (l.absent_days + l.unpaid_leave_days + l.half_days * 0.5), 0) as payable_days
    from eligible_employees ee
    join lop l on l.employee_id = ee.employee_id
    where ee.working_days > 0
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
    greatest(round((c.gross / c.working_days) * c.payable_days - c.deductions, 2), 0),
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

grant execute on function public.generate_payroll_for_month(integer, integer) to authenticated;
