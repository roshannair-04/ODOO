"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { approveLeaveAction, rejectLeaveAction } from "@/app/actions/leave";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { initials, formatDate } from "@/lib/utils";

export interface QueueRow {
  id: string;
  employeeName: string;
  employeePhotoUrl: string | null;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  reason: string | null;
}

type PendingAction = { row: QueueRow; kind: "approve" | "reject" };

export function LeaveApprovalQueue({ rows }: { rows: QueueRow[] }) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleDecide() {
    if (!pendingAction) return;
    setSubmitting(true);
    const action = pendingAction.kind === "approve" ? approveLeaveAction : rejectLeaveAction;
    const result = await action({ requestId: pendingAction.row.id, comment });
    setSubmitting(false);

    if (result.ok) {
      toast.success(result.message);
      router.refresh();
      setPendingAction(null);
      setComment("");
    } else {
      toast.error(result.message);
    }
  }

  return (
    <>
      <Card className="overflow-hidden p-0">
        <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Decision</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length > 0 ? (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          {row.employeePhotoUrl && <AvatarImage src={row.employeePhotoUrl} alt={row.employeeName} />}
                          <AvatarFallback className="text-[11px]">{initials(row.employeeName)}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">{row.employeeName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.leaveTypeName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.startDate === row.endDate ? formatDate(row.startDate) : `${formatDate(row.startDate)} – ${formatDate(row.endDate)}`}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.daysCount}</TableCell>
                    <TableCell className="max-w-48 truncate text-sm text-muted-foreground" title={row.reason ?? undefined}>
                      {row.reason || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Approve ${row.employeeName}'s request`}
                          onClick={() => setPendingAction({ row, kind: "approve" })}
                        >
                          <Check className="size-4 text-success" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Reject ${row.employeeName}'s request`}
                          onClick={() => setPendingAction({ row, kind: "reject" })}
                        >
                          <X className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    No pending requests. You&apos;re all caught up.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
        </Table>
      </Card>

      <Dialog open={!!pendingAction} onOpenChange={(open) => !open && setPendingAction(null)}>
        {pendingAction && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{pendingAction.kind === "approve" ? "Approve" : "Reject"} leave request</DialogTitle>
              <DialogDescription>
                {pendingAction.row.employeeName} · {pendingAction.row.leaveTypeName} ·{" "}
                {pendingAction.row.startDate === pendingAction.row.endDate
                  ? formatDate(pendingAction.row.startDate)
                  : `${formatDate(pendingAction.row.startDate)} – ${formatDate(pendingAction.row.endDate)}`}
                {pendingAction.kind === "approve" && " — this will also mark attendance for those days."}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="comment">Comment (optional)</Label>
              <Textarea id="comment" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
            </div>

            <DialogFooter className="justify-end gap-2">
              <Button
                variant={pendingAction.kind === "reject" ? "destructive" : "default"}
                disabled={submitting}
                onClick={handleDecide}
              >
                {submitting ? "Saving…" : pendingAction.kind === "approve" ? "Approve" : "Reject"}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
