"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Eye } from "lucide-react";
import { getPayslipBreakdownAction, type PayslipBreakdown } from "@/app/actions/payroll";
import { formatMoney } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export interface PayslipSummary {
  id: string;
  employeeName?: string;
  monthLabel: string;
  workingDays: number;
  payableDays: number;
  lopDays: number;
  gross: number;
  deductions: number;
  net: number;
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className={muted ? "text-muted-foreground" : ""}>{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

export function PayslipBreakdownDialog({ payslip }: { payslip: PayslipSummary }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [breakdown, setBreakdown] = useState<PayslipBreakdown | null>(null);

  async function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next && !breakdown) {
      setLoading(true);
      const result = await getPayslipBreakdownAction(payslip.id);
      setLoading(false);
      if (result.ok) setBreakdown(result.breakdown);
      else toast.error(result.message);
    }
  }

  const perDay = payslip.workingDays > 0 ? payslip.gross / payslip.workingDays : 0;
  const absentDays = breakdown ? breakdown.absentMarkedDays + breakdown.absentUnmarkedDays : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Eye /> Breakdown
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{payslip.monthLabel}</DialogTitle>
          <DialogDescription>
            {payslip.employeeName ? `${payslip.employeeName} · ` : ""}Derived from attendance — nothing here was
            typed in separately.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Loading…</p>
        ) : breakdown ? (
          <div className="flex flex-col divide-y divide-border">
            <div className="pb-2">
              <Row label="Working days" value={String(breakdown.workingDays)} muted />
              <Row label="Present" value={String(breakdown.presentDays)} />
              <Row label="Half days" value={`${breakdown.halfDays} (× 0.5)`} />
              <Row label="Paid leave" value={String(breakdown.paidLeaveDays)} />
              {breakdown.unpaidLeaveDays > 0 && (
                <Row label="Unpaid leave (LOP)" value={String(breakdown.unpaidLeaveDays)} />
              )}
              {absentDays !== null && absentDays > 0 && <Row label="Absent (LOP)" value={String(absentDays)} />}
            </div>
            <div className="py-2">
              <Row label="Payable days" value={`${payslip.payableDays} of ${payslip.workingDays}`} />
              <Row label="LOP days" value={String(payslip.lopDays)} muted />
            </div>
            <div className="py-2">
              <Row label="Gross (monthly)" value={formatMoney(payslip.gross)} muted />
              <Row label="Per-day rate" value={formatMoney(perDay)} muted />
              <Row label="Deductions" value={`− ${formatMoney(payslip.deductions)}`} muted />
            </div>
            <div className="pt-2">
              <Row label="Net pay" value={formatMoney(payslip.net)} />
            </div>
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">Couldn&apos;t load the breakdown.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
