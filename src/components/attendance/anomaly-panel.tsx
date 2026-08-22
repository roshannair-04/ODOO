import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { initials } from "@/lib/utils";
import type { AttendanceAnomalyRow } from "@/lib/attendance-anomalies";

export function AnomalyPanel({ rows, windowDays }: { rows: AttendanceAnomalyRow[]; windowDays: number }) {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-4 text-warning" />
        <h2 className="text-sm font-semibold">Needs attention</h2>
        <span className="text-xs text-muted-foreground">— last {windowDays} days</span>
      </div>

      {rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No attendance anomalies in the last {windowDays} days.
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {rows.map((row) => (
            <Link
              key={row.employeeId}
              href={`/employees/${row.employeeId}`}
              className="flex flex-col gap-2 py-3 transition-colors hover:bg-muted sm:flex-row sm:items-center sm:justify-between sm:gap-4 -mx-4 px-4"
            >
              <div className="flex items-center gap-2.5">
                <Avatar className="size-8">
                  {row.photoUrl && <AvatarImage src={row.photoUrl} alt={row.fullName} />}
                  <AvatarFallback>{initials(row.fullName)}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{row.fullName}</span>
                  <span className="text-xs text-muted-foreground">{row.employeeCode}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 sm:justify-end">
                {row.reasons.map((reason) => (
                  <Badge key={reason} variant={row.maxAbsentStreak >= 3 ? "destructive" : "warning"}>
                    {reason}
                  </Badge>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
