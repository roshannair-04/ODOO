"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/auth";
import { applyLeaveSchema, decideLeaveSchema } from "@/lib/validations/leave";
import type { ActionResult } from "@/app/actions/auth";

// All four mutations below go through the Postgres functions in
// 0004_leave_functions.sql (apply/approve/reject/cancel) rather than plain
// table writes — that's where the balance math and the leave -> attendance
// write on approval actually live, atomically, under SECURITY DEFINER.

export async function applyLeaveAction(input: unknown): Promise<ActionResult> {
  const employee = await getCurrentEmployee();
  if (!employee) return { ok: false, message: "You need to sign in again." };

  const parsed = applyLeaveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("apply_leave_request", {
    p_leave_type_id: v.leaveTypeId,
    p_start_date: v.startDate,
    p_end_date: v.endDate,
    p_is_half_day: v.isHalfDay,
    p_reason: v.reason || null,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath("/leave");
  revalidatePath("/dashboard");
  return { ok: true, message: "Leave request submitted." };
}

export async function cancelLeaveAction(requestId: string): Promise<ActionResult> {
  const employee = await getCurrentEmployee();
  if (!employee) return { ok: false, message: "You need to sign in again." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_leave_request", { p_request_id: requestId });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/leave");
  return { ok: true, message: "Leave request cancelled." };
}

export async function approveLeaveAction(input: unknown): Promise<ActionResult> {
  const employee = await getCurrentEmployee();
  if (!employee) return { ok: false, message: "You need to sign in again." };

  const parsed = decideLeaveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_leave_request", {
    p_request_id: parsed.data.requestId,
    p_comment: parsed.data.comment || null,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath("/leave");
  revalidatePath("/attendance");
  return { ok: true, message: "Leave approved. Attendance updated for those days." };
}

export async function rejectLeaveAction(input: unknown): Promise<ActionResult> {
  const employee = await getCurrentEmployee();
  if (!employee) return { ok: false, message: "You need to sign in again." };

  const parsed = decideLeaveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_leave_request", {
    p_request_id: parsed.data.requestId,
    p_comment: parsed.data.comment || null,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath("/leave");
  return { ok: true, message: "Leave request rejected." };
}
