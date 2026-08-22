import type { Metadata } from "next";
import { requireEmployee } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EmployeeProfileForm } from "@/components/employees/employee-profile-form";

export const metadata: Metadata = {
  title: "Your profile",
  description: "View and update your personal details.",
};

export default async function ProfilePage() {
  const actor = await requireEmployee();
  const supabase = await createClient();

  const [{ data: employee }, { data: departments }, { data: managers }] = await Promise.all([
    supabase
      .from("employees")
      .select(
        "id, employee_code, full_name, email, phone, address, photo_url, designation, department_id, manager_id, status, role, date_of_joining"
      )
      .eq("id", actor.id)
      .single(),
    supabase.from("departments").select("id, name").order("name"),
    supabase.from("employees").select("id, full_name").order("full_name"),
  ]);

  if (!employee) {
    return <p className="text-sm text-muted-foreground">We couldn&apos;t load your profile. Try refreshing.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Your profile</h1>
        <p className="text-sm text-muted-foreground">Personal details, job details and your photo.</p>
      </div>
      <EmployeeProfileForm
        employee={employee}
        canEditAll={actor.role === "admin"}
        departments={departments ?? []}
        managers={managers ?? []}
      />
    </div>
  );
}
