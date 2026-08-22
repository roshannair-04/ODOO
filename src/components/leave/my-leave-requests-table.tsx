"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X } from "lucide-react";
import { cancelLeaveAction } from "@/app/actions/leave";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import type { LeaveRequestStatus } from "@/lib/supabase/types";

export interface MyLeaveRow {
  id: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  isHalfDay: boolean;
  status: LeaveRequestStatus;
  reason: string | null;
  approverComment: string | null;
}

const STATUS_VARIANT: Record<LeaveRequestStatus, "success" | "warning" | "secondary" | "destructive"> = {
  approved: "success",
  pending: "warning",
  cancelled: "secondary",
  rejected: "destructive",
};

export function MyLeaveRequestsTable({ rows }: { rows: MyLeaveRow[] }) {
  const router = useRouter();
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  async function handleCancel(id: string) {
    setCancellingId(id);
    const result = await cancelLeaveAction(id);
    setCancellingId(null);
    if (result.ok) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  }

  return (
    <Card className="overflow-hidden p-0">
      <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length > 0 ? (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-sm font-medium">{row.leaveTypeName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.startDate === row.endDate ? formatDate(row.startDate) : `${formatDate(row.startDate)} – ${formatDate(row.endDate)}`}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{row.daysCount}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[row.status]}>
                      {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-48 truncate text-sm text-muted-foreground" title={row.reason ?? undefined}>
                    {row.reason || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.status === "pending" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Cancel request"
                        disabled={cancellingId === row.id}
                        onClick={() => handleCancel(row.id)}
                      >
                        <X className="size-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  No leave requests yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
      </Table>
    </Card>
  );
}
