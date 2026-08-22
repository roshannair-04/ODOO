import type { Metadata } from "next";
import Link from "next/link";
import { Users, Building2, CalendarClock, UserCheck, User, CalendarCheck, Wallet } from "lucide-react";
import { requireEmployee } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { StatTile } from "@/components/site/stat-tile";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { initials, formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your Dayflow overview.",
};

const quickLinks = [
  { href: "/profile", label: "Profile", icon: User },
  { href: "/attendance", label: "Attendance", icon: CalendarCheck },
  { href: "/leave", label: "Leave requests", icon: CalendarClock },
  { href: "/payroll", label: "Payroll", icon: Wallet },
];

export default async function DashboardPage() {
  const employee = await requireEmployee();

  if (employee.role === "admin") {
    return <AdminDashboard adminName={employee.full_name} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Hi {employee.full_name.split(" ")[0]} 👋</h1>
        <p className="text-sm text-muted-foreground">Here&apos;s your Dayflow at a glance.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {quickLinks.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="h-full transition-colors hover:border-primary/40 hover:bg-primary-soft/40">
              <CardContent className="flex flex-col items-center gap-2 pt-6 pb-5 text-center">
                <span className="flex size-9 items-center justify-center rounded-md bg-primary-soft text-primary">
                  <link.icon className="size-4.5" />
                </span>
                <span className="text-sm font-medium">{link.label}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

async function AdminDashboard({ adminName }: { adminName: string }) {
  const supabase = await createClient();

  const [{ count: employeeCount }, { count: activeCount }, { count: departmentCount }, { data: recent }] =
    await Promise.all([
      supabase.from("employees").select("id", { count: "exact", head: true }),
      supabase.from("employees").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("departments").select("id", { count: "exact", head: true }),
      supabase
        .from("employees")
        .select("id, full_name, email, designation, photo_url, created_at, role")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Hi {adminName.split(" ")[0]} 👋</h1>
        <p className="text-sm text-muted-foreground">Here&apos;s what&apos;s happening across the company.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Employees" value={employeeCount ?? 0} icon={Users} />
        <StatTile label="Active" value={activeCount ?? 0} icon={UserCheck} />
        <StatTile label="Departments" value={departmentCount ?? 0} icon={Building2} />
        <StatTile label="Pending leave" value={0} icon={CalendarClock} />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Recently added</CardTitle>
          <Link href="/employees" className="text-xs font-medium text-primary hover:underline">
            View all
          </Link>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          {recent && recent.length > 0 ? (
            recent.map((person) => (
              <Link
                key={person.id}
                href={`/employees/${person.id}`}
                className="flex items-center gap-3 rounded-md px-2 py-2 -mx-2 transition-colors hover:bg-muted"
              >
                <Avatar>
                  {person.photo_url && <AvatarImage src={person.photo_url} alt={person.full_name} />}
                  <AvatarFallback>{initials(person.full_name)}</AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{person.full_name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {person.designation ?? "No designation set"}
                  </span>
                </div>
                <Badge variant="outline" className="shrink-0">
                  {formatDate(person.created_at)}
                </Badge>
              </Link>
            ))
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">No employees yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
