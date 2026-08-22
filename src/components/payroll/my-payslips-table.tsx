import { Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PayslipBreakdownDialog, type PayslipSummary } from "@/components/payroll/payslip-breakdown-dialog";
import { formatMoney } from "@/lib/utils";
import type { PayslipStatus } from "@/lib/supabase/types";

export interface MyPayslipRow extends PayslipSummary {
  status: PayslipStatus;
}

const STATUS_VARIANT: Record<PayslipStatus, "success" | "secondary"> = {
  final: "success",
  draft: "secondary",
};
const STATUS_LABEL: Record<PayslipStatus, string> = {
  final: "Finalized",
  draft: "Draft",
};

export function MyPayslipsTable({ rows }: { rows: MyPayslipRow[] }) {
  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Month</TableHead>
            <TableHead>Payable days</TableHead>
            <TableHead>Gross</TableHead>
            <TableHead>Deductions</TableHead>
            <TableHead>Net pay</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">&nbsp;</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length > 0 ? (
            rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="text-sm font-medium">{row.monthLabel}</TableCell>
                <TableCell className="text-sm tabular-nums">
                  {row.payableDays} / {row.workingDays}
                </TableCell>
                <TableCell className="text-sm tabular-nums">{formatMoney(row.gross)}</TableCell>
                <TableCell className="text-sm tabular-nums text-muted-foreground">
                  − {formatMoney(row.deductions)}
                </TableCell>
                <TableCell className="text-sm font-medium tabular-nums">{formatMoney(row.net)}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <PayslipBreakdownDialog payslip={row} />
                    <Button variant="ghost" size="sm" asChild>
                      <a href={`/api/payslips/${row.id}/pdf`}>
                        <Download /> PDF
                      </a>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                No payslips yet — they&apos;ll show up here once payroll is generated.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
