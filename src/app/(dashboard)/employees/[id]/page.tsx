import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EmployeeProfileForm } from "@/components/employees/employee-profile-form";
import { SalaryCard } from "@/components/employees/salary-card";
import { Badge } from "@/components/ui/badge";
import { titleCase } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("employees").select("full_name").eq("id", id).single();
  return { title: data ? data.full_name : "Employee" };
}

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: employee }, { data: departments }, { data: managers }, { data: salaryRows }] = await Promise.all([
    supabase
      .from("employees")
      .select(
        "id, employee_code, full_name, email, phone, address, photo_url, designation, department_id, manager_id, status, role, date_of_joining"
      )
      .eq("id", id)
      .single(),
    supabase.from("departments").select("id, name").order("name"),
    supabase.from("employees").select("id, full_name").order("full_name"),
    supabase
      .from("salary_structure")
      .select("basic, hra, allowances, deductions, effective_from")
      .eq("employee_id", id)
      .order("effective_from", { ascending: false })
      .limit(1),
  ]);

  if (!employee) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-headline font-semibold">{employee.full_name}</h1>
        <Badge variant={employee.role === "admin" ? "default" : "secondary"}>{titleCase(employee.role)}</Badge>
        <Badge variant={employee.status === "active" ? "success" : "secondary"}>{titleCase(employee.status)}</Badge>
      </div>
      <EmployeeProfileForm employee={employee} canEditAll departments={departments ?? []} managers={managers ?? []} />
      <SalaryCard employeeId={employee.id} current={salaryRows?.[0] ?? null} />
    </div>
  );
}
