import type { Metadata } from "next";
import { Users, TrendingUp, CalendarClock, Wallet } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { RealtimeRefresher } from "@/components/site/realtime-refresher";
import { StatTile } from "@/components/site/stat-tile";
import { Card } from "@/components/ui/card";
import { AttendanceTrendChart } from "@/components/analytics/attendance-trend-chart";
import { BarChart } from "@/components/analytics/bar-chart";
import { formatMoney, todayISO } from "@/lib/utils";
import {
  computeAttendanceTrend,
  computeAttendanceRate,
  computeLeaveUtilization,
  computePayrollCostTrend,
  computeDepartmentHeadcount,
} from "@/lib/analytics";

export const metadata: Metadata = {
  title: "Analytics",
  description: "Attendance, leave and payroll analytics across the company.",
};

function addDaysISO(iso: string, delta: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

export default async function AnalyticsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const today = todayISO();
  const [todayYear, todayMonth] = today.split("-").map(Number);
  const historyStart = addDaysISO(today, -34); // enough calendar days to cover 14 working days

  const [
    { data: employees, error: employeesError },
    { data: attendanceHistory, error: attendanceError },
    { data: holidayRows },
    { data: balances },
    { data: payslips },
    { count: pendingLeaveCount },
  ] = await Promise.all([
    supabase
      .from("employees")
      .select("id, departments!department_id(name)")
      .eq("status", "active"),
    supabase.from("attendance").select("employee_id, date, status").gte("date", historyStart).lte("date", today),
    supabase.from("holidays").select("date").gte("date", historyStart).lte("date", today),
    supabase
      .from("leave_balances")
      .select("used, pending, leave_types(name)")
      .eq("year", todayYear),
    supabase.from("payslips").select("month, year, net"),
    supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  if (employeesError) console.error("[AnalyticsPage] failed to load employees:", employeesError.message);
  if (attendanceError) console.error("[AnalyticsPage] failed to load attendance:", attendanceError.message);

  const holidays = new Set((holidayRows ?? []).map((h) => h.date));

  const trend = computeAttendanceTrend({
    attendanceRows: attendanceHistory ?? [],
    holidays,
    referenceDate: today,
    workingDaysCount: 14,
  });

  const attendanceRate = computeAttendanceRate(attendanceHistory ?? []);

  const leaveUtilization = computeLeaveUtilization(
    (balances ?? []).map((b) => ({
      leaveTypeName: (b.leave_types as unknown as { name: string } | null)?.name ?? "Leave",
      used: b.used,
      pending: b.pending,
    }))
  );

  const payrollCostTrend = computePayrollCostTrend(payslips ?? [], todayMonth, todayYear, 6);
  const currentMonthCost = payrollCostTrend[payrollCostTrend.length - 1]?.value ?? 0;

  const headcount = computeDepartmentHeadcount(
    (employees ?? []).map((e) => ({
      departmentName: (e.departments as unknown as { name: string } | null)?.name ?? null,
    }))
  );

  return (
    <div className="flex flex-col gap-4">
      <RealtimeRefresher channel="analytics-admin" tables={["attendance", "leave_requests", "payslips"]} />
      <div>
        <h1 className="text-headline font-semibold">Analytics</h1>
        <p className="text-sm text-muted-foreground">Company-wide attendance, leave and payroll trends.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Active employees" value={employees?.length ?? 0} icon={Users} />
        <StatTile
          label="Attendance rate (30d)"
          value={`${Math.round(attendanceRate.rate * 100)}%`}
          icon={TrendingUp}
          tone={attendanceRate.rate < 0.85 ? "warning" : "default"}
        />
        <StatTile
          label="Pending leave requests"
          value={pendingLeaveCount ?? 0}
          icon={CalendarClock}
          tone={(pendingLeaveCount ?? 0) > 0 ? "warning" : "default"}
        />
        <StatTile label="Payroll cost (this month)" value={formatMoney(currentMonthCost)} icon={Wallet} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="flex flex-col gap-3 p-4 lg:col-span-2">
          <div>
            <h2 className="text-sm font-semibold">Attendance, last 14 working days</h2>
            <p className="text-xs text-muted-foreground">Status mix across every active employee, by day.</p>
          </div>
          <AttendanceTrendChart data={trend} />
        </Card>

        <Card className="flex flex-col gap-3 p-4">
          <div>
            <h2 className="text-sm font-semibold">Payroll cost, last 6 months</h2>
            <p className="text-xs text-muted-foreground">Net pay across all payslips generated for the month.</p>
          </div>
          <BarChart data={payrollCostTrend} orientation="vertical" valueFormatter={formatMoney} />
        </Card>

        <Card className="flex flex-col gap-3 p-4">
          <div>
            <h2 className="text-sm font-semibold">Leave utilisation, {todayYear}</h2>
            <p className="text-xs text-muted-foreground">Days used per leave type, company-wide.</p>
          </div>
          <BarChart
            data={leaveUtilization}
            orientation="horizontal"
            color="var(--color-primary)"
            valueFormatter={(n) => `${n}d`}
            emptyLabel="No leave taken yet this year."
          />
        </Card>

        <Card className="flex flex-col gap-3 p-4 lg:col-span-2">
          <div>
            <h2 className="text-sm font-semibold">Headcount by department</h2>
            <p className="text-xs text-muted-foreground">Active employees.</p>
          </div>
          <BarChart data={headcount} orientation="horizontal" color="var(--color-success)" />
        </Card>
      </div>
    </div>
  );
}
