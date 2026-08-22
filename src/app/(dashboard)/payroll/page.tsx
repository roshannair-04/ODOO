import type { Metadata } from "next";
import { Wallet } from "lucide-react";
import { ComingSoon } from "@/components/site/coming-soon";

export const metadata: Metadata = {
  title: "Payroll",
  description: "View and manage salary structure and payslips.",
};

export default function PayrollPage() {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-xl font-semibold">Payroll</h1>
      <p className="mb-4 text-sm text-muted-foreground">Salary structure and monthly payslips.</p>
      <ComingSoon
        icon={Wallet}
        title="Payroll lands in the next phase"
        description="Payslips generated from attendance, with a visible day-by-day breakdown, are being built next."
      />
    </div>
  );
}
