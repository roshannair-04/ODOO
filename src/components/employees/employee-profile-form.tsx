"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { adminEditSchema, type AdminEditInput } from "@/lib/validations/employee";
import { updateEmployeeAction } from "@/app/actions/employees";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { AvatarUpload } from "@/components/employees/avatar-upload";

interface Department {
  id: string;
  name: string;
}
interface ManagerOption {
  id: string;
  full_name: string;
}

export interface EmployeeProfileData {
  id: string;
  employee_code: string;
  full_name: string;
  email: string;
  phone: string | null;
  address: string | null;
  photo_url: string | null;
  designation: string | null;
  department_id: string | null;
  manager_id: string | null;
  status: "active" | "inactive";
  role: "admin" | "employee";
  date_of_joining: string;
}

export function EmployeeProfileForm({
  employee,
  canEditAll,
  departments,
  managers,
}: {
  employee: EmployeeProfileData;
  canEditAll: boolean;
  departments: Department[];
  managers: ManagerOption[];
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  // The server action re-validates and scopes writes by role (see
  // updateEmployeeAction) — this client resolver only needs to keep the form
  // usable, since defaultValues already satisfy the full schema either way.
  const form = useForm<AdminEditInput>({
    resolver: zodResolver(adminEditSchema),
    defaultValues: {
      fullName: employee.full_name,
      phone: employee.phone ?? "",
      address: employee.address ?? "",
      designation: employee.designation ?? "",
      departmentId: employee.department_id ?? "",
      managerId: employee.manager_id ?? "",
      status: employee.status,
      role: employee.role,
      dateOfJoining: employee.date_of_joining,
    },
  });

  async function onSubmit(values: AdminEditInput) {
    setSubmitting(true);
    const result = await updateEmployeeAction(employee.id, values);
    setSubmitting(false);

    if (result.ok) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  }

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile photo</CardTitle>
        </CardHeader>
        <CardContent>
          <AvatarUpload employeeId={employee.id} fullName={employee.full_name} photoUrl={employee.photo_url} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Personal details</CardTitle>
          <CardDescription>
            {canEditAll ? "Visible to the whole company directory." : "You can update your contact details here."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fullName">Full name</Label>
            {canEditAll ? (
              <Input id="fullName" invalid={!!errors.fullName} {...register("fullName")} />
            ) : (
              <p className="flex h-9 items-center text-sm">{employee.full_name}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Employee ID</Label>
            <p className="flex h-9 items-center font-mono text-sm text-muted-foreground">{employee.employee_code}</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Email</Label>
            <p className="flex h-9 items-center text-sm text-muted-foreground">{employee.email}</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" type="tel" placeholder="+91 90000 00000" {...register("phone")} />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Textarea id="address" rows={2} {...register("address")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Job details</CardTitle>
          <CardDescription>{canEditAll ? "Only admins can change these." : "Set by your admin."}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="designation">Designation</Label>
            {canEditAll ? (
              <Input id="designation" placeholder="e.g. Software Engineer" {...register("designation")} />
            ) : (
              <p className="flex h-9 items-center text-sm text-muted-foreground">{employee.designation ?? "—"}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Date of joining</Label>
            {canEditAll ? (
              <Input id="dateOfJoining" type="date" {...register("dateOfJoining")} />
            ) : (
              <p className="flex h-9 items-center text-sm text-muted-foreground">{employee.date_of_joining}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Department</Label>
            {canEditAll ? (
              <Select
                defaultValue={employee.department_id ?? undefined}
                onValueChange={(v) => form.setValue("departmentId", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="flex h-9 items-center text-sm text-muted-foreground">
                {departments.find((d) => d.id === employee.department_id)?.name ?? "—"}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Manager</Label>
            {canEditAll ? (
              <Select
                defaultValue={employee.manager_id ?? undefined}
                onValueChange={(v) => form.setValue("managerId", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No manager" />
                </SelectTrigger>
                <SelectContent>
                  {managers
                    .filter((m) => m.id !== employee.id)
                    .map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.full_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="flex h-9 items-center text-sm text-muted-foreground">
                {managers.find((m) => m.id === employee.manager_id)?.full_name ?? "—"}
              </p>
            )}
          </div>

          {canEditAll && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label>Status</Label>
                <Select defaultValue={employee.status} onValueChange={(v) => form.setValue("status", v as "active" | "inactive")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Role</Label>
                <Select defaultValue={employee.role} onValueChange={(v) => form.setValue("role", v as "admin" | "employee")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="admin">Admin / HR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save changes"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
