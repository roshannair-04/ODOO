import type { Metadata } from "next";
import { requireEmployee } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { RealtimeRefresher } from "@/components/site/realtime-refresher";
import { PayrollControls } from "@/components/payroll/payroll-controls";
import { AdminPayslipTable, type AdminPayslipRow } from "@/components/payroll/admin-payslip-table";
import { MyPayslipsTable, type MyPayslipRow } from "@/components/payroll/my-payslips-table";
import { todayISO } from "@/lib/utils";
import type { PayslipStatus } from "@/lib/supabase/types";

export const metadata: Metadata = {
  title: "Payroll",
  description: "View and manage salary structure and payslips.",
};

const MONTH_LABEL = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" });

function monthLabel(month: number, year: number) {
  return MONTH_LABEL.format(new Date(Date.UTC(year, month - 1, 1)));
}

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const employee = await requireEmployee();

  if (employee.role === "admin") {
    const params = await searchParams;
    const today = todayISO();
    const [defaultYear, defaultMonth] = today.split("-").map(Number);
    const month = Number(params.month) || defaultMonth;
    const year = Number(params.year) || defaultYear;
    const maxMonth = `${defaultYear}-${String(defaultMonth).padStart(2, "0")}`;

    return <AdminView month={month} year={year} maxMonth={maxMonth} />;
  }

  return <EmployeeView employeeId={employee.id} />;
}

async function AdminView({ month, year, maxMonth }: { month: number; year: number; maxMonth: string }) {
  const supabase = await createClient();

  const { data: payslips, error } = await supabase
    .from("payslips")
    .select(
      "id, working_days, payable_days, lop_days, gross, deductions, net, status, employees!employee_id(full_name, employee_code, photo_url, departments!department_id(name))"
    )
    .eq("month", month)
    .eq("year", year)
    .order("generated_at", { ascending: true });

  if (error) console.error("[PayrollAdminView] failed to load payslips:", error.message);

  const rows: AdminPayslipRow[] = (payslips ?? []).map((row) => {
    const emp = row.employees as unknown as {
      full_name: string;
      employee_code: string;
      photo_url: string | null;
      departments: { name: string } | null;
    } | null;
    return {
      id: row.id,
      employeeName: emp?.full_name ?? "Unknown",
      employeeCode: emp?.employee_code ?? "—",
      photoUrl: emp?.photo_url ?? null,
      departmentName: emp?.departments?.name ?? null,
      monthLabel: monthLabel(month, year),
      workingDays: Number(row.working_days),
      payableDays: Number(row.payable_days),
      lopDays: Number(row.lop_days),
      gross: Number(row.gross),
      deductions: Number(row.deductions),
      net: Number(row.net),
      status: row.status as PayslipStatus,
    };
  });

  const hasAny = rows.length > 0;
  const hasDrafts = rows.some((row) => row.status === "draft");

  return (
    <div className="flex flex-col gap-4">
      <RealtimeRefresher channel="payroll-admin" tables={["payslips"]} />
      <div>
        <h1 className="text-headline font-semibold">Payroll</h1>
        <p className="text-sm text-muted-foreground">
          Payslips are derived from attendance — nothing here is typed in separately.
        </p>
      </div>

      <PayrollControls month={month} year={year} hasDrafts={hasDrafts} hasAny={hasAny} maxMonth={maxMonth} />

      <AdminPayslipTable rows={rows} />
    </div>
  );
}

async function EmployeeView({ employeeId }: { employeeId: string }) {
  const supabase = await createClient();

  const { data: payslips, error } = await supabase
    .from("payslips")
    .select("id, month, year, working_days, payable_days, lop_days, gross, deductions, net, status")
    .eq("employee_id", employeeId)
    .order("year", { ascending: false })
    .order("month", { ascending: false });

  if (error) console.error("[PayrollEmployeeView] failed to load payslips:", error.message);

  const rows: MyPayslipRow[] = (payslips ?? []).map((row) => ({
    id: row.id,
    monthLabel: monthLabel(row.month, row.year),
    workingDays: Number(row.working_days),
    payableDays: Number(row.payable_days),
    lopDays: Number(row.lop_days),
    gross: Number(row.gross),
    deductions: Number(row.deductions),
    net: Number(row.net),
    status: row.status as PayslipStatus,
  }));

  return (
    <div className="flex flex-col gap-4">
      <RealtimeRefresher channel={`payroll-${employeeId}`} tables={["payslips"]} />
      <div>
        <h1 className="text-headline font-semibold">Payroll</h1>
        <p className="text-sm text-muted-foreground">
          Your payslip history, derived from attendance each month.
        </p>
      </div>

      <MyPayslipsTable rows={rows} />
    </div>
  );
}
