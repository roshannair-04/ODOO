import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { ComingSoon } from "@/components/site/coming-soon";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Analytics",
  description: "Attendance, leave and payroll analytics across the company.",
};

export default async function AnalyticsPage() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-xl font-semibold">Analytics</h1>
      <p className="mb-4 text-sm text-muted-foreground">Company-wide attendance and leave trends.</p>
      <ComingSoon
        icon={BarChart3}
        title="Analytics lands in a later phase"
        description="Attendance rate, leave utilisation and headcount charts are being built next."
      />
    </div>
  );
}
