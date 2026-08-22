"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/auth";
import { monthYearSchema } from "@/lib/validations/payroll";
import type { ActionResult } from "@/app/actions/auth";

// Generation and finalization both go through the Postgres functions in
// 0005/0006_payroll_*.sql — that's where the day-by-day derivation from
// attendance actually happens, atomically, under SECURITY DEFINER.

export async function generatePayrollAction(input: unknown): Promise<ActionResult> {
  const employee = await getCurrentEmployee();
  if (!employee) return { ok: false, message: "You need to sign in again." };

  const parsed = monthYearSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Pick a valid month." };
  }

  // A month that hasn't started yet has no attendance to derive payroll
  // from, so generate_payroll_for_month correctly returns zero rows for it
  // (count_working_days walks an inverted range and comes back 0). But the
  // generic empty-result message below is misleading for that specific
  // case — it implies a data problem when the real reason is just "too
  // early" — so catch it up front with an accurate message instead of
  // even making the round trip.
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;
  if (parsed.data.year > currentYear || (parsed.data.year === currentYear && parsed.data.month > currentMonth)) {
    return {
      ok: false,
      message: "That month hasn't started yet — payroll is derived from attendance, so there's nothing to generate until it's under way.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_payroll_for_month", {
    p_month: parsed.data.month,
    p_year: parsed.data.year,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath("/payroll");
  const count = data?.length ?? 0;
  return {
    ok: true,
    message:
      count > 0
        ? `Generated ${count} payslip${count === 1 ? "" : "s"}.`
        : "No draft payslips to generate — everyone eligible is already finalized, or no one has a salary set yet.",
  };
}

export async function finalizePayrollAction(input: unknown): Promise<ActionResult> {
  const employee = await getCurrentEmployee();
  if (!employee) return { ok: false, message: "You need to sign in again." };

  const parsed = monthYearSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Pick a valid month." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("finalize_payroll_for_month", {
    p_month: parsed.data.month,
    p_year: parsed.data.year,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath("/payroll");
  const count = data?.length ?? 0;
  return {
    ok: true,
    message: count > 0 ? `Finalized ${count} payslip${count === 1 ? "" : "s"}. They're locked in.` : "Nothing to finalize — generate payroll for this month first.",
  };
}

export interface PayslipBreakdown {
  workingDays: number;
  presentDays: number;
  halfDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  absentMarkedDays: number;
  absentUnmarkedDays: number;
}

/**
 * Re-derives the same day-by-day picture generate_payroll_for_month used,
 * for display only — the stored payslip numbers are the source of truth,
 * this just explains them. Self or admin only.
 */
export async function getPayslipBreakdownAction(payslipId: string): Promise<
  { ok: true; breakdown: PayslipBreakdown } | { ok: false; message: string }
> {
  const actor = await getCurrentEmployee();
  if (!actor) return { ok: false, message: "You need to sign in again." };

  const supabase = await createClient();

  const { data: payslip, error: payslipError } = await supabase
    .from("payslips")
    .select("employee_id, month, year, working_days")
    .eq("id", payslipId)
    .maybeSingle();

  if (payslipError || !payslip) return { ok: false, message: "Payslip not found." };
  if (payslip.employee_id !== actor.id && actor.role !== "admin") {
    return { ok: false, message: "You don't have permission to view this payslip." };
  }

  const { data: employeeRow } = await supabase
    .from("employees")
    .select("date_of_joining")
    .eq("id", payslip.employee_id)
    .single();

  const monthStart = new Date(Date.UTC(payslip.year, payslip.month - 1, 1));
  const monthEnd = new Date(Date.UTC(payslip.year, payslip.month, 0));
  const joinDate = employeeRow?.date_of_joining ? new Date(`${employeeRow.date_of_joining}T00:00:00Z`) : monthStart;
  const effectiveStart = joinDate > monthStart ? joinDate : monthStart;

  const [{ data: attendanceRows }, { data: holidays }, { data: leaveTypes }] = await Promise.all([
    supabase
      .from("attendance")
      .select("date, status, note")
      .eq("employee_id", payslip.employee_id)
      .gte("date", effectiveStart.toISOString().slice(0, 10))
      .lte("date", monthEnd.toISOString().slice(0, 10)),
    supabase
      .from("holidays")
      .select("date")
      .gte("date", effectiveStart.toISOString().slice(0, 10))
      .lte("date", monthEnd.toISOString().slice(0, 10)),
    supabase.from("leave_types").select("name, is_paid"),
  ]);

  const holidaySet = new Set((holidays ?? []).map((h) => h.date));
  const paidByName = new Map((leaveTypes ?? []).map((t) => [t.name, t.is_paid]));

  const isWorkingDay = (isoDate: string) => {
    const [y, m, d] = isoDate.split("-").map(Number);
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    return dow !== 0 && dow !== 6 && !holidaySet.has(isoDate);
  };

  const attendanceByDate = new Map((attendanceRows ?? []).filter((r) => isWorkingDay(r.date)).map((r) => [r.date, r]));

  let presentDays = 0;
  let halfDays = 0;
  let paidLeaveDays = 0;
  let unpaidLeaveDays = 0;
  let absentMarkedDays = 0;
  let absentUnmarkedDays = 0;

  for (let d = new Date(effectiveStart); d <= monthEnd; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    if (!isWorkingDay(iso)) continue;
    const row = attendanceByDate.get(iso);
    if (!row) {
      absentUnmarkedDays += 1;
    } else if (row.status === "present") {
      presentDays += 1;
    } else if (row.status === "half_day") {
      halfDays += 1;
    } else if (row.status === "absent") {
      absentMarkedDays += 1;
    } else if (row.status === "leave") {
      const isPaid = row.note ? (paidByName.get(row.note) ?? true) : true;
      if (isPaid) paidLeaveDays += 1;
      else unpaidLeaveDays += 1;
    }
  }

  return {
    ok: true,
    breakdown: {
      workingDays: payslip.working_days,
      presentDays,
      halfDays,
      paidLeaveDays,
      unpaidLeaveDays,
      absentMarkedDays,
      absentUnmarkedDays,
    },
  };
}
