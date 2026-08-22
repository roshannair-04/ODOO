import type { Metadata } from "next";
import { requireEmployee } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CheckInCard } from "@/components/attendance/check-in-card";
import { AdminAttendanceGrid, type GridRow } from "@/components/attendance/admin-attendance-grid";
import { AnomalyPanel } from "@/components/attendance/anomaly-panel";
import { RealtimeRefresher } from "@/components/site/realtime-refresher";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate, todayISO } from "@/lib/utils";
import { computeAttendanceAnomalies } from "@/lib/attendance-anomalies";
import type { AttendanceStatus } from "@/lib/supabase/types";

const ANOMALY_WINDOW_DAYS = 30;

export const metadata: Metadata = {
  title: "Attendance",
  description: "Daily and weekly check-in, check-out and attendance history.",
};

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  half_day: "Half day",
  leave: "Leave",
};
const STATUS_VARIANT: Record<AttendanceStatus, "success" | "warning" | "secondary" | "destructive"> = {
  present: "success",
  half_day: "warning",
  leave: "secondary",
  absent: "destructive",
};

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const employee = await requireEmployee();

  if (employee.role === "admin") {
    const params = await searchParams;
    const date = typeof params.date === "string" && params.date ? params.date : todayISO();

    return <AdminView date={date} />;
  }

  return <EmployeeView employeeId={employee.id} />;
}

async function EmployeeView({ employeeId }: { employeeId: string }) {
  const supabase = await createClient();
  const today = todayISO();

  const [{ data: todayRow }, { data: history }] = await Promise.all([
    supabase
      .from("attendance")
      .select("check_in_at, check_out_at, status, worked_minutes")
      .eq("employee_id", employeeId)
      .eq("date", today)
      .maybeSingle(),
    supabase
      .from("attendance")
      .select("date, check_in_at, check_out_at, status, worked_minutes")
      .eq("employee_id", employeeId)
      .order("date", { ascending: false })
      .limit(14),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <RealtimeRefresher channel={`attendance-${employeeId}`} tables={["attendance"]} />
      <div>
        <h1 className="text-headline font-semibold">Attendance</h1>
        <p className="text-sm text-muted-foreground">Check in, check out, and review your attendance history.</p>
      </div>

      <CheckInCard today={todayRow ?? null} />

      <Card className="overflow-hidden p-0">
        <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Check in</TableHead>
                <TableHead>Check out</TableHead>
                <TableHead>Worked</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history && history.length > 0 ? (
                history.map((row) => {
                  const status = row.status as AttendanceStatus;
                  return (
                  <TableRow key={row.date}>
                    <TableCell className="text-sm">{formatDate(row.date)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.check_in_at
                        ? new Date(row.check_in_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.check_out_at
                        ? new Date(row.check_out_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.worked_minutes != null ? `${Math.floor(row.worked_minutes / 60)}h ${row.worked_minutes % 60}m` : "—"}
                    </TableCell>
                  </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    No attendance history yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
        </Table>
      </Card>
    </div>
  );
}

async function AdminView({ date }: { date: string }) {
  const supabase = await createClient();
  const today = todayISO();
  const windowStart = new Date(Date.UTC(...(today.split("-").map(Number) as [number, number, number])));
  windowStart.setUTCDate(windowStart.getUTCDate() - (ANOMALY_WINDOW_DAYS - 1));
  const windowStartISO = windowStart.toISOString().slice(0, 10);

  const [
    { data: employees, error: employeesError },
    { data: attendanceRows, error: attendanceError },
    { data: historyRows },
    { data: holidayRows },
  ] = await Promise.all([
    supabase
      .from("employees")
      .select("id, full_name, employee_code, photo_url, status, date_of_joining, departments!department_id(name)")
      .eq("status", "active")
      .order("full_name"),
    supabase.from("attendance").select("employee_id, status, check_in_at, check_out_at, note").eq("date", date),
    supabase
      .from("attendance")
      .select("employee_id, date, status")
      .gte("date", windowStartISO)
      .lte("date", today),
    supabase.from("holidays").select("date").gte("date", windowStartISO).lte("date", today),
  ]);

  if (employeesError) console.error("[AttendanceAdminView] failed to load employees:", employeesError.message);
  if (attendanceError) console.error("[AttendanceAdminView] failed to load attendance:", attendanceError.message);

  const attendanceByEmployee = new Map((attendanceRows ?? []).map((row) => [row.employee_id, row]));

  const anomalyRows = computeAttendanceAnomalies({
    employees: (employees ?? []).map((person) => ({
      id: person.id,
      full_name: person.full_name,
      employee_code: person.employee_code,
      photo_url: person.photo_url,
      date_of_joining: person.date_of_joining,
    })),
    attendanceRows: historyRows ?? [],
    holidays: new Set((holidayRows ?? []).map((h) => h.date)),
    windowEnd: today,
    windowDays: ANOMALY_WINDOW_DAYS,
  });

  const rows: GridRow[] = (employees ?? []).map((person) => {
    const attendance = attendanceByEmployee.get(person.id);
    return {
      employeeId: person.id,
      fullName: person.full_name,
      employeeCode: person.employee_code,
      photoUrl: person.photo_url,
      departmentName: (person.departments as unknown as { name: string } | null)?.name ?? null,
      attendance: attendance
        ? {
            status: attendance.status,
            check_in_at: attendance.check_in_at,
            check_out_at: attendance.check_out_at,
            note: attendance.note,
          }
        : null,
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <RealtimeRefresher channel="attendance-admin" tables={["attendance"]} />
      <div>
        <h1 className="text-headline font-semibold">Attendance</h1>
        <p className="text-sm text-muted-foreground">Review and correct attendance across the company.</p>
      </div>

      <AdminAttendanceGrid date={date} rows={rows} />

      <AnomalyPanel rows={anomalyRows} windowDays={ANOMALY_WINDOW_DAYS} />
    </div>
  );
}
