"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/auth";
import { selfEditSchema, adminEditSchema } from "@/lib/validations/employee";
import type { ActionResult } from "@/app/actions/auth";

export async function updateEmployeeAction(employeeId: string, input: unknown): Promise<ActionResult> {
  const actor = await getCurrentEmployee();
  if (!actor) return { ok: false, message: "You need to sign in again." };

  const isSelf = actor.id === employeeId;
  const isAdmin = actor.role === "admin";
  if (!isSelf && !isAdmin) {
    return { ok: false, message: "You don't have permission to edit this profile." };
  }

  const supabase = await createClient();

  if (isAdmin) {
    const parsed = adminEditSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form and try again." };
    }
    const v = parsed.data;
    const { error } = await supabase
      .from("employees")
      .update({
        full_name: v.fullName,
        phone: v.phone || null,
        address: v.address || null,
        designation: v.designation || null,
        department_id: v.departmentId || null,
        manager_id: v.managerId || null,
        status: v.status,
        role: v.role,
        date_of_joining: v.dateOfJoining,
      })
      .eq("id", employeeId);

    if (error) return { ok: false, message: error.message };
  } else {
    const parsed = selfEditSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form and try again." };
    }
    const v = parsed.data;
    const { error } = await supabase
      .from("employees")
      .update({ phone: v.phone || null, address: v.address || null })
      .eq("id", employeeId);

    if (error) return { ok: false, message: error.message };
  }

  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/profile");
  revalidatePath("/employees");
  return { ok: true, message: "Profile updated." };
}

export async function updatePhotoAction(employeeId: string, photoUrl: string): Promise<ActionResult> {
  const actor = await getCurrentEmployee();
  if (!actor) return { ok: false, message: "You need to sign in again." };
  if (actor.id !== employeeId && actor.role !== "admin") {
    return { ok: false, message: "You don't have permission to edit this profile." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("employees").update({ photo_url: photoUrl }).eq("id", employeeId);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/profile");
  return { ok: true, message: "Photo updated." };
}
