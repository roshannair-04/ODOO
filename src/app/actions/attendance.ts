"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee, requireAdmin } from "@/lib/auth";
import { attendanceCorrectionSchema, markAllPresentSchema } from "@/lib/validations/attendance";
import { monthYearSchema } from "@/lib/validations/payroll";
import { todayISO } from "@/lib/utils";
import type { ActionResult } from "@/app/actions/auth";

// Below this many worked minutes on check-out, the day is logged as a half
// day rather than a full present — keeps the attendance ledger honest
// without needing a separate manual step.
const HALF_DAY_THRESHOLD_MINUTES = 240;

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

export async function checkInAction(): Promise<ActionResult> {
  const employee = await getCurrentEmployee();
  if (!employee) return { ok: false, message: "You need to sign in again." };

  const supabase = await createClient();
  const date = todayISO();

  const { data: existing } = await supabase
    .from("attendance")
    .select("id, check_in_at")
    .eq("employee_id", employee.id)
    .eq("date", date)
    .maybeSingle();

  if (existing?.check_in_at) {
    return { ok: false, message: "You've already checked in today." };
  }

  const { error } = await supabase.from("attendance").upsert(
    {
      employee_id: employee.id,
      date,
      check_in_at: new Date().toISOString(),
      check_out_at: null,
      worked_minutes: null,
      status: "present",
      source: "self",
      note: null,
    },
    { onConflict: "employee_id,date" }
  );

  if (error) return { ok: false, message: error.message };

  revalidatePath("/attendance");
  revalidatePath("/dashboard");
  return { ok: true, message: "Checked in. Have a good one!" };
}

export async function checkOutAction(): Promise<ActionResult> {
  const employee = await getCurrentEmployee();
  if (!employee) return { ok: false, message: "You need to sign in again." };

  const supabase = await createClient();
  const date = todayISO();

  const { data: existing } = await supabase
    .from("attendance")
    .select("id, check_in_at, check_out_at")
    .eq("employee_id", employee.id)
    .eq("date", date)
    .maybeSingle();

  if (!existing?.check_in_at) {
    return { ok: false, message: "Check in first before checking out." };
  }
  if (existing.check_out_at) {
    return { ok: false, message: "You've already checked out today." };
  }

  const checkOutAt = new Date();
  const workedMinutes = Math.max(
    0,
    Math.round((checkOutAt.getTime() - new Date(existing.check_in_at).getTime()) / 60000)
  );
  const status = workedMinutes < HALF_DAY_THRESHOLD_MINUTES ? "half_day" : "present";

  const { error } = await supabase
    .from("attendance")
    .update({ check_out_at: checkOutAt.toISOString(), worked_minutes: workedMinutes, status })
    .eq("id", existing.id);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/attendance");
  revalidatePath("/dashboard");
  return {
    ok: true,
    message:
      status === "half_day"
        ? `Checked out. Logged as a half day (${Math.round((workedMinutes / 60) * 10) / 10}h).`
        : "Checked out. See you tomorrow!",
  };
}

export async function adminCorrectionAction(input: unknown): Promise<ActionResult> {
  await requireAdmin();

  const parsed = attendanceCorrectionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }
  const v = parsed.data;

  const checkInAt = v.checkInTime ? new Date(`${v.date}T${v.checkInTime}:00`).toISOString() : null;
  const checkOutAt = v.checkOutTime ? new Date(`${v.date}T${v.checkOutTime}:00`).toISOString() : null;
  const workedMinutes =
    checkInAt && checkOutAt
      ? Math.max(0, Math.round((new Date(checkOutAt).getTime() - new Date(checkInAt).getTime()) / 60000))
      : null;

  const supabase = await createClient();
  const { error } = await supabase.from("attendance").upsert(
    {
      employee_id: v.employeeId,
      date: v.date,
      check_in_at: checkInAt,
      check_out_at: checkOutAt,
      worked_minutes: workedMinutes,
      status: v.status,
      source: "admin",
      note: v.note || null,
    },
    { onConflict: "employee_id,date" }
  );

  if (error) return { ok: false, message: error.message };

  revalidatePath("/attendance");
  return { ok: true, message: "Attendance updated." };
}

// Bulk-fills "present" for every active employee who doesn't already have
// an attendance row for the day — check-ins, admin corrections, and leave
// (written by the leave-approval function) are never overwritten, since
// this only touches employees with no row at all yet.
export async function markAllPresentAction(input: unknown): Promise<ActionResult> {
  await requireAdmin();

  const parsed = markAllPresentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Pick a valid date." };
  }
  const { date } = parsed.data;

  if (date > todayISO()) {
    return { ok: false, message: "Can't mark attendance for a day that hasn't happened yet." };
  }

  const supabase = await createClient();

  const [{ data: employees, error: employeesError }, { data: existing, error: existingError }] = await Promise.all([
    supabase.from("employees").select("id").eq("status", "active"),
    supabase.from("attendance").select("employee_id").eq("date", date),
  ]);

  if (employeesError) return { ok: false, message: employeesError.message };
  if (existingError) return { ok: false, message: existingError.message };

  const alreadyMarked = new Set((existing ?? []).map((row) => row.employee_id));
  const toMark = (employees ?? []).map((e) => e.id).filter((id) => !alreadyMarked.has(id));

  if (toMark.length === 0) {
    return { ok: true, message: "Everyone already has attendance marked for this day." };
  }

  const { error } = await supabase.from("attendance").upsert(
    toMark.map((employeeId) => ({
      employee_id: employeeId,
      date,
      check_in_at: null,
      check_out_at: null,
      worked_minutes: null,
      status: "present" as const,
      source: "admin" as const,
      note: null,
    })),
    { onConflict: "employee_id,date", ignoreDuplicates: true }
  );

  if (error) return { ok: false, message: error.message };

  revalidatePath("/attendance");
  return { ok: true, message: `Marked ${toMark.length} employee${toMark.length === 1 ? "" : "s"} present.` };
}

// Same idea as markAllPresentAction, but for every working day in a month
// at once — walks each active employee from whichever is later of month
// start or their date_of_joining, through whichever is earlier of month
// end or today (mirrors the payroll cutoff — you can't mark a day present
// before it's happened), skipping weekends, holidays, and any day that
// already has a row (again: leave and prior corrections are untouched).
export async function markAllPresentForMonthAction(input: unknown): Promise<ActionResult> {
  await requireAdmin();

  const parsed = monthYearSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Pick a valid month." };
  }
  const { month, year } = parsed.data;

  const today = todayISO();
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);

  if (monthStart > today) {
    return { ok: false, message: "That month hasn't started yet — there's nothing to mark." };
  }

  const cutoff = monthEnd < today ? monthEnd : today;

  const supabase = await createClient();

  const [
    { data: employees, error: employeesError },
    { data: existingRows, error: existingError },
    { data: holidayRows },
  ] = await Promise.all([
    supabase.from("employees").select("id, date_of_joining").eq("status", "active"),
    supabase.from("attendance").select("employee_id, date").gte("date", monthStart).lte("date", cutoff),
    supabase.from("holidays").select("date").gte("date", monthStart).lte("date", cutoff),
  ]);

  if (employeesError) return { ok: false, message: employeesError.message };
  if (existingError) return { ok: false, message: existingError.message };

  const holidays = new Set((holidayRows ?? []).map((h) => h.date));
  const alreadyMarked = new Set((existingRows ?? []).map((row) => `${row.employee_id}:${row.date}`));

  const rows: {
    employee_id: string;
    date: string;
    check_in_at: null;
    check_out_at: null;
    worked_minutes: null;
    status: "present";
    source: "admin";
    note: null;
  }[] = [];

  for (const emp of employees ?? []) {
    const effectiveStart = emp.date_of_joining && emp.date_of_joining > monthStart ? emp.date_of_joining : monthStart;
    for (let iso = effectiveStart; iso <= cutoff; iso = addDaysISO(iso, 1)) {
      if (isWeekend(iso) || holidays.has(iso)) continue;
      if (alreadyMarked.has(`${emp.id}:${iso}`)) continue;
      rows.push({
        employee_id: emp.id,
        date: iso,
        check_in_at: null,
        check_out_at: null,
        worked_minutes: null,
        status: "present",
        source: "admin",
        note: null,
      });
    }
  }

  if (rows.length === 0) {
    return { ok: true, message: "Everyone already has attendance marked for every working day so far this month." };
  }

  const { error } = await supabase.from("attendance").upsert(rows, { onConflict: "employee_id,date", ignoreDuplicates: true });

  if (error) return { ok: false, message: error.message };

  revalidatePath("/attendance");
  const employeeCount = new Set(rows.map((r) => r.employee_id)).size;
  return {
    ok: true,
    message: `Marked ${rows.length} day${rows.length === 1 ? "" : "s"} present across ${employeeCount} employee${employeeCount === 1 ? "" : "s"}.`,
  };
}
