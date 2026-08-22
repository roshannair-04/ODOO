import type { Metadata } from "next";
import { CalendarClock } from "lucide-react";
import { requireEmployee } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LeaveApplySection } from "@/components/leave/leave-apply-section";
import { MyLeaveRequestsTable, type MyLeaveRow } from "@/components/leave/my-leave-requests-table";
import { LeaveApprovalQueue, type QueueRow } from "@/components/leave/leave-approval-queue";
import { RealtimeRefresher } from "@/components/site/realtime-refresher";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Leave",
  description: "Apply for leave and track approval status.",
};

export default async function LeavePage() {
  const employee = await requireEmployee();
  const supabase = await createClient();
  const year = new Date().getFullYear();

  const [{ data: leaveTypes }, { data: balances }, { data: myRequests }] = await Promise.all([
    supabase.from("leave_types").select("id, name, is_paid, annual_quota").order("name"),
    supabase
      .from("leave_balances")
      .select("leave_type_id, allocated, used, pending, carried_forward, leave_types(name)")
      .eq("employee_id", employee.id)
      .eq("year", year),
    supabase
      .from("leave_requests")
      .select("id, start_date, end_date, is_half_day, days_count, status, reason, approver_comment, leave_types(name)")
      .eq("employee_id", employee.id)
      .order("created_at", { ascending: false }),
  ]);

  const balanceByType = new Map((balances ?? []).map((b) => [b.leave_type_id, b]));

  const myRows: MyLeaveRow[] = (myRequests ?? []).map((r) => ({
    id: r.id,
    leaveTypeName: (r.leave_types as unknown as { name: string } | null)?.name ?? "Leave",
    startDate: r.start_date,
    endDate: r.end_date,
    daysCount: r.days_count,
    isHalfDay: r.is_half_day,
    status: r.status,
    reason: r.reason,
    approverComment: r.approver_comment,
  }));

  const content = (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {(leaveTypes ?? [])
          .filter((t) => t.is_paid)
          .map((type) => {
            const balance = balanceByType.get(type.id);
            const available = balance
              ? balance.allocated + balance.carried_forward - balance.used - balance.pending
              : type.annual_quota;
            return (
              <Card key={type.id}>
                <CardContent className="flex flex-col gap-1 pt-5">
                  <span className="text-headline font-semibold tabular-nums">{available}</span>
                  <span className="text-xs text-muted-foreground">{type.name} remaining</span>
                </CardContent>
              </Card>
            );
          })}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">My requests</h2>
        <LeaveApplySection leaveTypes={leaveTypes ?? []} />
      </div>

      <MyLeaveRequestsTable rows={myRows} />
    </div>
  );

  if (employee.role !== "admin") {
    return (
      <div className="flex flex-col gap-1">
        <RealtimeRefresher channel={`leave-${employee.id}`} tables={["leave_requests", "leave_balances"]} />
        <h1 className="text-headline font-semibold">Leave</h1>
        <p className="mb-4 text-sm text-muted-foreground">Apply for time off and track approvals.</p>
        {content}
      </div>
    );
  }

  const { data: pendingRequests, error: pendingError } = await supabase
    .from("leave_requests")
    .select("id, start_date, end_date, days_count, reason, employees!employee_id(full_name, photo_url), leave_types(name)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (pendingError) console.error("[LeavePage] failed to load pending requests:", pendingError.message);

  const queueRows: QueueRow[] = (pendingRequests ?? []).map((r) => ({
    id: r.id,
    employeeName: (r.employees as unknown as { full_name: string } | null)?.full_name ?? "Unknown",
    employeePhotoUrl: (r.employees as unknown as { photo_url: string | null } | null)?.photo_url ?? null,
    leaveTypeName: (r.leave_types as unknown as { name: string } | null)?.name ?? "Leave",
    startDate: r.start_date,
    endDate: r.end_date,
    daysCount: r.days_count,
    reason: r.reason,
  }));

  return (
    <div className="flex flex-col gap-1">
      <RealtimeRefresher channel="leave-admin" tables={["leave_requests", "leave_balances", "attendance"]} />
      <div className="flex items-center gap-2">
        <CalendarClock className="size-5 text-muted-foreground" />
        <h1 className="text-headline font-semibold">Leave</h1>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">Review approvals, and manage your own leave requests.</p>

      <Tabs defaultValue="approvals">
        <TabsList>
          <TabsTrigger value="approvals">
            Approvals {queueRows.length > 0 && `(${queueRows.length})`}
          </TabsTrigger>
          <TabsTrigger value="mine">My leave</TabsTrigger>
        </TabsList>
        <TabsContent value="approvals">
          <LeaveApprovalQueue rows={queueRows} />
        </TabsContent>
        <TabsContent value="mine">{content}</TabsContent>
      </Tabs>
    </div>
  );
}
