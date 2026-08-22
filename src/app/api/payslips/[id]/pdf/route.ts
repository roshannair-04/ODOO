import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/auth";

export const runtime = "nodejs";

const MONTH_LABEL = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" });
const PDF_MONEY = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 0,
});

function toNumber(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function formatPdfMoney(value: number | string | null | undefined) {
  return `INR ${PDF_MONEY.format(toNumber(value))}`;
}

function safePdfText(value: string | null | undefined, fallback = "-") {
  const text = value?.trim() || fallback;
  return text
    .replace(/\u20b9/g, "INR ")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2212/g, "-")
    .replace(/[^\x20-\x7E]/g, "");
}

// Renders the same numbers the payslip already stores — this does not
// recompute anything, it only lays them out. Basic/HRA/allowances are shown
// pro-rated by payable/working days for a readable earnings breakdown, using
// whichever salary_structure row was effective for that month (same
// latest-on-or-before-month-end lookup generate_payroll_for_month uses).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const actor = await getCurrentEmployee();
  if (!actor) return NextResponse.json({ message: "You need to sign in again." }, { status: 401 });

  const supabase = await createClient();

  const { data: payslip, error: payslipError } = await supabase
    .from("payslips")
    .select(
      "employee_id, month, year, working_days, payable_days, lop_days, gross, deductions, net, status, employees!employee_id(full_name, employee_code, designation, date_of_joining, departments!department_id(name))"
    )
    .eq("id", id)
    .maybeSingle();

  if (payslipError || !payslip) {
    return NextResponse.json({ message: "Payslip not found." }, { status: 404 });
  }
  if (payslip.employee_id !== actor.id && actor.role !== "admin") {
    return NextResponse.json({ message: "You don't have permission to view this payslip." }, { status: 403 });
  }

  const employee = payslip.employees as unknown as {
    full_name: string;
    employee_code: string;
    designation: string | null;
    date_of_joining: string;
    departments: { name: string } | null;
  } | null;

  const monthEnd = new Date(Date.UTC(payslip.year, payslip.month, 0)).toISOString().slice(0, 10);
  const { data: salaryRow } = await supabase
    .from("salary_structure")
    .select("basic, hra, allowances")
    .eq("employee_id", payslip.employee_id)
    .lte("effective_from", monthEnd)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  const workingDays = toNumber(payslip.working_days);
  const payableDays = toNumber(payslip.payable_days);
  const ratio = workingDays > 0 ? payableDays / workingDays : 0;
  const earnedBasic = Math.round(toNumber(salaryRow?.basic) * ratio * 100) / 100;
  const earnedHra = Math.round(toNumber(salaryRow?.hra) * ratio * 100) / 100;
  const earnedAllowances = Math.round(toNumber(salaryRow?.allowances) * ratio * 100) / 100;
  const grossEarned = toNumber(payslip.net) + toNumber(payslip.deductions);

  const doc = new PDFDocument({ margin: 50, size: "A4" });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const ink = "#1a1a1a";
  const muted = "#6b6b6b";
  const line = "#dcdcdc";
  const monthLabel = MONTH_LABEL.format(new Date(Date.UTC(payslip.year, payslip.month - 1, 1)));

  doc.fillColor(ink).font("Helvetica-Bold").fontSize(20).text("Dayflow", 50, 50);
  doc.font("Helvetica").fontSize(10).fillColor(muted).text("Payslip - derived from attendance", 50, 74);

  doc.fillColor(ink).font("Helvetica-Bold").fontSize(13).text(monthLabel, 0, 50, { align: "right" });
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(muted)
    .text(payslip.status === "final" ? "Finalized" : "Draft", 0, 68, { align: "right" });

  doc.moveTo(50, 105).lineTo(545, 105).strokeColor(line).stroke();

  let y = 122;
  const row = (label: string, value: string) => {
    doc.font("Helvetica").fontSize(10).fillColor(muted).text(label, 50, y);
    doc.font("Helvetica-Bold").fontSize(10).fillColor(ink).text(value, 300, y, { width: 195, align: "right" });
    y += 18;
  };

  row("Employee", safePdfText(employee?.full_name));
  row("Employee code", safePdfText(employee?.employee_code));
  row("Designation", safePdfText(employee?.designation));
  row("Department", safePdfText(employee?.departments?.name));

  y += 14;
  doc.font("Helvetica-Bold").fontSize(11).fillColor(ink).text("Attendance", 50, y);
  y += 20;
  row("Working days", String(workingDays));
  row("Payable days", String(payableDays));
  row("Loss of pay days", String(Number(payslip.lop_days)));

  y += 14;
  doc.font("Helvetica-Bold").fontSize(11).fillColor(ink).text("Earnings", 50, y);
  y += 20;
  row("Basic", formatPdfMoney(earnedBasic));
  row("HRA", formatPdfMoney(earnedHra));
  row("Allowances", formatPdfMoney(earnedAllowances));
  row("Gross earned", formatPdfMoney(grossEarned));

  y += 14;
  doc.font("Helvetica-Bold").fontSize(11).fillColor(ink).text("Deductions", 50, y);
  y += 20;
  row("Deductions", `- ${formatPdfMoney(payslip.deductions)}`);

  y += 10;
  doc.moveTo(50, y).lineTo(545, y).strokeColor(line).stroke();
  y += 16;
  doc.font("Helvetica-Bold").fontSize(13).fillColor(ink).text("Net pay", 50, y);
  doc.font("Helvetica-Bold").fontSize(13).fillColor(ink).text(formatPdfMoney(payslip.net), 300, y, { width: 195, align: "right" });

  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(muted)
    .text(
      "System-generated payslip. Every figure above is derived from attendance and leave records - nothing here was entered by hand.",
      50,
      750,
      { width: 495 }
    );

  doc.end();
  const pdfBuffer = await done;

  const filenameSafeName = (employee?.full_name ?? "employee").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="payslip-${filenameSafeName}-${payslip.year}-${String(payslip.month).padStart(2, "0")}.pdf"`,
    },
  });
}
