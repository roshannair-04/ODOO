import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/supabase/types";

export interface CurrentEmployee {
  id: string;
  user_id: string;
  employee_code: string;
  full_name: string;
  email: string;
  role: Role;
  photo_url: string | null;
  department_id: string | null;
  designation: string | null;
}

/**
 * Loads the signed-in user's employee row. Returns null if not signed in,
 * or if auth exists but the employee row hasn't been provisioned yet
 * (shouldn't happen in normal flow — sign-up creates both atomically).
 */
export async function getCurrentEmployee(): Promise<CurrentEmployee | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("employees")
    .select("id, user_id, employee_code, full_name, email, role, photo_url, department_id, designation")
    .eq("user_id", user.id)
    .single();

  return data as CurrentEmployee | null;
}

/** Server Component / Server Action guard: redirects to sign-in if not authenticated. */
export async function requireEmployee(): Promise<CurrentEmployee> {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/sign-in");
  return employee;
}

/** Server Component / Server Action guard: redirects non-admins to their dashboard. */
export async function requireAdmin(): Promise<CurrentEmployee> {
  const employee = await requireEmployee();
  if (employee.role !== "admin") redirect("/dashboard");
  return employee;
}
