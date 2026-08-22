"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/auth";
import { setSalarySchema } from "@/lib/validations/salary";
import { todayISO } from "@/lib/utils";
import type { ActionResult } from "@/app/actions/auth";

/**
 * Set an employee's salary structure, admin only. Inserted as a new
 * versioned row effective today rather than editing history in place — an
 * edit made today never changes what an already-generated payslip for last
 * month was computed from. Editing again the same day updates that same
 * day's row instead of stacking duplicates.
 */
export async function setSalaryAction(employeeId: string, input: unknown): Promise<ActionResult> {
  const actor = await getCurrentEmployee();
  if (!actor || actor.role !== "admin") {
    return { ok: false, message: "Only an admin can set salary structure." };
  }

  const parsed = setSalarySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("salary_structure").upsert(
    {
      employee_id: employeeId,
      effective_from: todayISO(),
      basic: v.basic,
      hra: v.hra,
      allowances: v.allowances,
      deductions: v.deductions,
      created_by: actor.id,
    },
    { onConflict: "employee_id,effective_from" }
  );

  if (error) return { ok: false, message: error.message };

  revalidatePath(`/employees/${employeeId}`);
  return { ok: true, message: "Salary structure updated." };
}
