import type { AttendanceStatus } from "@/lib/supabase/types";

// Pure aggregation over data the app already has — attendance, leave
// balances, payslips, employees. Nothing here writes anything; it exists to
// turn rows into the small series each analytics chart plots.

function addDaysISO(iso: string, delta: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function isWeekend(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow === 0 || dow === 6;
}

export interface AttendanceTrendDay {
  date: string;
  label: string;
  present: number;
  half_day: number;
  leave: number;
  absent: number;
  total: number;
}

const DAY_LABEL = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" });

/** Last `workingDaysCount` working days (weekday, non-holiday) ending at `referenceDate`, each day's status counts across every active employee. */
export function computeAttendanceTrend({
  attendanceRows,
  holidays,
  referenceDate,
  workingDaysCount = 14,
}: {
  attendanceRows: { date: string; status: AttendanceStatus }[];
  holidays: Set<string>;
  referenceDate: string;
  workingDaysCount?: number;
}): AttendanceTrendDay[] {
  const countsByDate = new Map<string, Record<AttendanceStatus, number>>();
  for (const row of attendanceRows) {
    if (!countsByDate.has(row.date)) countsByDate.set(row.date, { present: 0, half_day: 0, leave: 0, absent: 0 });
    countsByDate.get(row.date)![row.status] += 1;
  }

  const days: AttendanceTrendDay[] = [];
  let iso = referenceDate;
  while (days.length < workingDaysCount) {
    if (!isWeekend(iso) && !holidays.has(iso)) {
      const counts = countsByDate.get(iso) ?? { present: 0, half_day: 0, leave: 0, absent: 0 };
      days.push({
        date: iso,
        label: DAY_LABEL.format(new Date(`${iso}T00:00:00Z`)),
        present: counts.present,
        half_day: counts.half_day,
        leave: counts.leave,
        absent: counts.absent,
        total: counts.present + counts.half_day + counts.leave + counts.absent,
      });
    }
    iso = addDaysISO(iso, -1);
  }

  return days.reverse();
}

export interface AttendanceRateSummary {
  workingDays: number;
  presentEquivalent: number;
  rate: number;
}

/** Company-wide attendance rate across every marked day in the window (unmarked days are excluded — this is "of days marked, how many were present", not a penalty for missing marks). */
export function computeAttendanceRate(attendanceRows: { status: AttendanceStatus }[]): AttendanceRateSummary {
  let workingDays = 0;
  let presentEquivalent = 0;
  for (const row of attendanceRows) {
    if (row.status === "leave") continue;
    workingDays += 1;
    if (row.status === "present") presentEquivalent += 1;
    else if (row.status === "half_day") presentEquivalent += 0.5;
  }
  return { workingDays, presentEquivalent, rate: workingDays > 0 ? presentEquivalent / workingDays : 0 };
}

export interface BarDatum {
  key: string;
  label: string;
  value: number;
  detail?: string;
}

export function computeLeaveUtilization(
  balances: { leaveTypeName: string; used: number; pending: number }[]
): BarDatum[] {
  const byType = new Map<string, { used: number; pending: number }>();
  for (const b of balances) {
    if (!byType.has(b.leaveTypeName)) byType.set(b.leaveTypeName, { used: 0, pending: 0 });
    const entry = byType.get(b.leaveTypeName)!;
    entry.used += b.used;
    entry.pending += b.pending;
  }
  return Array.from(byType.entries())
    .map(([name, v]) => ({
      key: name,
      label: name,
      value: v.used,
      detail: v.pending > 0 ? `${v.used} days used · ${v.pending} pending` : `${v.used} days used`,
    }))
    .sort((a, b) => b.value - a.value);
}

const MONTH_SHORT = new Intl.DateTimeFormat("en-IN", { month: "short" });

export function computePayrollCostTrend(
  payslips: { month: number; year: number; net: number }[],
  referenceMonth: number,
  referenceYear: number,
  monthsBack = 6
): BarDatum[] {
  const totals = new Map<string, number>();
  for (const p of payslips) {
    const key = `${p.year}-${p.month}`;
    totals.set(key, (totals.get(key) ?? 0) + p.net);
  }

  const result: BarDatum[] = [];
  let m = referenceMonth;
  let y = referenceYear;
  for (let i = 0; i < monthsBack; i++) {
    const key = `${y}-${m}`;
    const total = totals.get(key) ?? 0;
    result.push({
      key,
      label: MONTH_SHORT.format(new Date(Date.UTC(y, m - 1, 1))),
      value: Math.round(total),
    });
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return result.reverse();
}

export function computeDepartmentHeadcount(
  employees: { departmentName: string | null }[]
): BarDatum[] {
  const counts = new Map<string, number>();
  for (const e of employees) {
    const name = e.departmentName ?? "Unassigned";
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ key: name, label: name, value: count }))
    .sort((a, b) => b.value - a.value);
}
