"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee, requireAdmin } from "@/lib/auth";
import { attendanceCorrectionSchema } from "@/lib/validations/attendance";
import { todayISO } from "@/lib/utils";
import type { ActionResult } from "@/app/actions/auth";

// Below this many worked minutes on check-out, the day is logged as a half
// day rather than a full present — keeps the attendance ledger honest
// without needing a separate manual step.
const HALF_DAY_THRESHOLD_MINUTES = 240;

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
