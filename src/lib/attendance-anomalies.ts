import type { AttendanceStatus } from "@/lib/supabase/types";

// Pure, read-only pattern-detection over the existing attendance ledger — no
// new schema, no new state. Same day-by-day, UTC-safe walk the payroll
// breakdown uses (getPayslipBreakdownAction), just over a rolling 30-day
// window instead of a calendar month, and flagging rather than paying.

export interface AnomalyEmployeeInput {
  id: string;
  full_name: string;
  employee_code: string;
  photo_url: string | null;
  date_of_joining: string;
}

export interface AnomalyAttendanceRow {
  employee_id: string;
  date: string;
  status: AttendanceStatus;
}

export interface AttendanceAnomalyRow {
  employeeId: string;
  fullName: string;
  employeeCode: string;
  photoUrl: string | null;
  workingDays: number;
  presentDays: number;
  absentDays: number;
  halfDays: number;
  attendanceRate: number;
  maxAbsentStreak: number;
  ongoingAbsentStreak: number;
  reasons: string[];
}

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

const ABSENCE_STREAK_THRESHOLD = 3;
const FREQUENT_ABSENCE_THRESHOLD = 4;
const LOW_ATTENDANCE_RATE = 0.7;
const EXCESS_HALF_DAY_THRESHOLD = 5;

export function computeAttendanceAnomalies({
  employees,
  attendanceRows,
  holidays,
  windowEnd,
  windowDays = 30,
}: {
  employees: AnomalyEmployeeInput[];
  attendanceRows: AnomalyAttendanceRow[];
  holidays: Set<string>;
  windowEnd: string;
  windowDays?: number;
}): AttendanceAnomalyRow[] {
  const windowStart = addDaysISO(windowEnd, -(windowDays - 1));

  const attendanceByEmployee = new Map<string, Map<string, AttendanceStatus>>();
  for (const row of attendanceRows) {
    if (!attendanceByEmployee.has(row.employee_id)) attendanceByEmployee.set(row.employee_id, new Map());
    attendanceByEmployee.get(row.employee_id)!.set(row.date, row.status);
  }

  const results: AttendanceAnomalyRow[] = [];

  for (const employee of employees) {
    const effectiveStart = employee.date_of_joining > windowStart ? employee.date_of_joining : windowStart;
    if (effectiveStart > windowEnd) continue;

    const byDate = attendanceByEmployee.get(employee.id) ?? new Map<string, AttendanceStatus>();

    let workingDays = 0;
    let presentDays = 0;
    let absentDays = 0;
    let halfDays = 0;
    let currentStreak = 0;
    let maxStreak = 0;

    for (let iso = effectiveStart; iso <= windowEnd; iso = addDaysISO(iso, 1)) {
      if (isWeekend(iso) || holidays.has(iso)) continue;
      workingDays += 1;
      const status = byDate.get(iso);

      if (!status || status === "absent") {
        absentDays += 1;
        currentStreak += 1;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 0;
        if (status === "present") presentDays += 1;
        else if (status === "half_day") halfDays += 1;
        // "leave" is an approved absence — never an anomaly signal.
      }
    }

    if (workingDays === 0) continue;

    const attendanceRate = (presentDays + halfDays * 0.5) / workingDays;
    const reasons: string[] = [];

    if (maxStreak >= ABSENCE_STREAK_THRESHOLD) {
      reasons.push(`${maxStreak}-day unexplained absence streak`);
    }
    if (absentDays >= FREQUENT_ABSENCE_THRESHOLD) {
      reasons.push(`${absentDays} unexplained absences in the last ${windowDays} days`);
    }
    if (attendanceRate < LOW_ATTENDANCE_RATE) {
      reasons.push(`Attendance rate ${Math.round(attendanceRate * 100)}%`);
    }
    if (halfDays >= EXCESS_HALF_DAY_THRESHOLD) {
      reasons.push(`${halfDays} half days`);
    }

    if (reasons.length === 0) continue;

    results.push({
      employeeId: employee.id,
      fullName: employee.full_name,
      employeeCode: employee.employee_code,
      photoUrl: employee.photo_url,
      workingDays,
      presentDays,
      absentDays,
      halfDays,
      attendanceRate,
      maxAbsentStreak: maxStreak,
      ongoingAbsentStreak: currentStreak,
      reasons,
    });
  }

  return results.sort((a, b) => b.reasons.length - a.reasons.length || b.absentDays - a.absentDays);
}
