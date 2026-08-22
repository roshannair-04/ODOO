import { Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PayslipBreakdownDialog, type PayslipSummary } from "@/components/payroll/payslip-breakdown-dialog";
import { formatMoney, initials } from "@/lib/utils";
import type { PayslipStatus } from "@/lib/supabase/types";

export interface AdminPayslipRow extends PayslipSummary {
  employeeCode: string;
  photoUrl: string | null;
  departmentName: string | null;
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

export function AdminPayslipTable({ rows }: { rows: AdminPayslipRow[] }) {
  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Department</TableHead>
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
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Avatar className="size-8">
                      {row.photoUrl && <AvatarImage src={row.photoUrl} alt={row.employeeName ?? ""} />}
                      <AvatarFallback>{initials(row.employeeName ?? "?")}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{row.employeeName}</span>
                      <span className="text-xs text-muted-foreground">{row.employeeCode}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{row.departmentName ?? "—"}</TableCell>
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
              <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                No payslips for this month yet — generate payroll to create drafts.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
