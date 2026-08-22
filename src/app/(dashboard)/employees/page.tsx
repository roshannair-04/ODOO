import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EmployeeFilters } from "@/components/employees/employee-filters";
import { PaginationControls } from "@/components/employees/pagination-controls";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { initials, formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Employees",
  description: "Search, filter and manage every employee in the company.",
};

const PAGE_SIZE = 10;

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireAdmin();
  const supabase = await createClient();
  const params = await searchParams;

  const q = typeof params.q === "string" ? params.q : "";
  const department = typeof params.department === "string" ? params.department : "";
  const status = typeof params.status === "string" ? params.status : "";
  const page = Math.max(1, Number(params.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: departments } = await supabase.from("departments").select("id, name").order("name");

  let query = supabase
    .from("employees")
    .select(
      "id, full_name, email, employee_code, designation, status, photo_url, date_of_joining, department_id, departments!department_id(name)",
      { count: "exact" }
    )
    .order("full_name");

  if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,employee_code.ilike.%${q}%`);
  if (department) query = query.eq("department_id", department);
  if (status) query = query.eq("status", status);

  const { data: employees, count, error } = await query.range(from, to);

  if (error) {
    console.error("[EmployeesPage] failed to load employees:", error.message);
  }

  const totalItems = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-headline font-semibold">Employees</h1>
        <p className="text-sm text-muted-foreground">{totalItems} people across {departments?.length ?? 0} departments.</p>
      </div>

      <EmployeeFilters departments={departments ?? []} />

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Employee ID</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees && employees.length > 0 ? (
              employees.map((person) => (
                <TableRow key={person.id} className="cursor-pointer">
                  <TableCell>
                    <Link href={`/employees/${person.id}`} className="flex items-center gap-3">
                      <Avatar className="size-8">
                        {person.photo_url && <AvatarImage src={person.photo_url} alt={person.full_name} />}
                        <AvatarFallback className="text-[11px]">{initials(person.full_name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{person.full_name}</span>
                        <span className="text-xs text-muted-foreground">{person.email}</span>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{person.employee_code}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {(person.departments as unknown as { name: string } | null)?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{person.designation ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(person.date_of_joining)}</TableCell>
                  <TableCell>
                    <Badge variant={person.status === "active" ? "success" : "secondary"}>
                      {person.status === "active" ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  No employees match your filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <PaginationControls page={page} totalPages={totalPages} totalItems={totalItems} pageSize={PAGE_SIZE} />
      </Card>
    </div>
  );
}
