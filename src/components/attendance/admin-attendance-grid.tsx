"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, ChevronDown, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { adminCorrectionAction, markAllPresentAction, markAllPresentForMonthAction } from "@/app/actions/attendance";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { initials, formatDate } from "@/lib/utils";
import type { AttendanceStatus } from "@/lib/supabase/types";

const MONTH_LABEL = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" });

export interface GridRow {
  employeeId: string;
  fullName: string;
  employeeCode: string;
  photoUrl: string | null;
  departmentName: string | null;
  attendance: {
    status: AttendanceStatus;
    check_in_at: string | null;
    check_out_at: string | null;
    note: string | null;
  } | null;
}

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  half_day: "Half day",
  leave: "Leave",
};

const STATUS_VARIANT: Record<AttendanceStatus, "success" | "warning" | "secondary" | "destructive"> = {
  present: "success",
  half_day: "warning",
  leave: "secondary",
  absent: "destructive",
};

function timeValue(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function AdminAttendanceGrid({ date, rows }: { date: string; rows: GridRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<GridRow | null>(null);
  const [marking, setMarking] = useState(false);

  function setDate(next: string) {
    router.push(`/attendance?date=${next}`);
  }

  const [year, month] = date.split("-").map(Number);
  const monthLabel = MONTH_LABEL.format(new Date(Date.UTC(year, month - 1, 1)));
  const unmarkedCount = rows.filter((row) => !row.attendance).length;

  async function handleMarkAllToday() {
    setMarking(true);
    const result = await markAllPresentAction({ date });
    setMarking(false);
    if (result.ok) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  }

  async function handleMarkAllMonth() {
    setMarking(true);
    const result = await markAllPresentForMonthAction({ month, year });
    setMarking(false);
    if (result.ok) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">{rows.length} employees</p>
        <div className="flex gap-2">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="sm:w-44" aria-label="Select date" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={marking}>
                <UserCheck /> {marking ? "Marking…" : "Mark all present"} <ChevronDown className="size-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[15rem]">
              <DropdownMenuLabel>Only fills in unmarked employees</DropdownMenuLabel>
              <DropdownMenuItem onSelect={handleMarkAllToday}>
                This day · {formatDate(date)}
                {unmarkedCount > 0 && <span className="ml-auto text-xs text-muted-foreground">{unmarkedCount} unmarked</span>}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleMarkAllMonth}>This month · {monthLabel}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Check in</TableHead>
              <TableHead>Check out</TableHead>
              <TableHead className="text-right">Correct</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length > 0 ? (
              rows.map((row) => (
                <TableRow key={row.employeeId}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        {row.photoUrl && <AvatarImage src={row.photoUrl} alt={row.fullName} />}
                        <AvatarFallback className="text-[11px]">{initials(row.fullName)}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{row.fullName}</span>
                        <span className="text-xs text-muted-foreground">{row.employeeCode}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{row.departmentName ?? "—"}</TableCell>
                  <TableCell>
                    {row.attendance ? (
                      <Badge variant={STATUS_VARIANT[row.attendance.status]}>{STATUS_LABEL[row.attendance.status]}</Badge>
                    ) : (
                      <Badge variant="outline">Not marked</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.attendance?.check_in_at
                      ? new Date(row.attendance.check_in_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
                      : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.attendance?.check_out_at
                      ? new Date(row.attendance.check_out_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" aria-label={`Correct attendance for ${row.fullName}`} onClick={() => setEditing(row)}>
                      <Pencil className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  No employees to show.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        {editing && <CorrectionForm date={date} row={editing} onDone={() => setEditing(null)} />}
      </Dialog>
    </>
  );
}

function CorrectionForm({ date, row, onDone }: { date: string; row: GridRow; onDone: () => void }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<AttendanceStatus>(row.attendance?.status ?? "present");
  const [checkInTime, setCheckInTime] = useState(timeValue(row.attendance?.check_in_at ?? null));
  const [checkOutTime, setCheckOutTime] = useState(timeValue(row.attendance?.check_out_at ?? null));
  const [note, setNote] = useState(row.attendance?.note ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const result = await adminCorrectionAction({
      employeeId: row.employeeId,
      date,
      status,
      checkInTime,
      checkOutTime,
      note,
    });
    setSubmitting(false);
    if (result.ok) {
      toast.success(result.message);
      router.refresh();
      onDone();
    } else {
      toast.error(result.message);
    }
  }

  return (
    <DialogContent>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle>Correct attendance</DialogTitle>
          <DialogDescription>
            {row.fullName} · {date}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as AttendanceStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="present">Present</SelectItem>
              <SelectItem value="half_day">Half day</SelectItem>
              <SelectItem value="absent">Absent</SelectItem>
              <SelectItem value="leave">Leave</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="checkInTime">Check in</Label>
            <Input id="checkInTime" type="time" value={checkInTime} onChange={(e) => setCheckInTime(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="checkOutTime">Check out</Label>
            <Input id="checkOutTime" type="time" value={checkOutTime} onChange={(e) => setCheckOutTime(e.target.value)} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="note">Note</Label>
          <Textarea id="note" rows={2} placeholder="Reason for the correction" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <DialogFooter className="justify-end gap-2">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save correction"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
