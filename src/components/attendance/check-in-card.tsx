"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, LogOut, Clock } from "lucide-react";
import { toast } from "sonner";
import { checkInAction, checkOutAction } from "@/app/actions/attendance";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface TodayAttendance {
  check_in_at: string | null;
  check_out_at: string | null;
  status: "present" | "absent" | "half_day" | "leave";
  worked_minutes: number | null;
}

function formatTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function formatHours(minutes: number | null) {
  if (minutes == null) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

export function CheckInCard({ today }: { today: TodayAttendance | null }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const isOnLeave = today?.status === "leave";
  const hasCheckedIn = !!today?.check_in_at;
  const hasCheckedOut = !!today?.check_out_at;

  async function handleCheckIn() {
    setPending(true);
    const result = await checkInAction();
    setPending(false);
    if (result.ok) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  }

  async function handleCheckOut() {
    setPending(true);
    const result = await checkOutAction();
    setPending(false);
    if (result.ok) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Clock className="size-5" />
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">
              {isOnLeave
                ? "You're on leave today"
                : hasCheckedOut
                  ? "You've completed today's shift"
                  : hasCheckedIn
                    ? "You're checked in"
                    : "You haven't checked in yet"}
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>In: {formatTime(today?.check_in_at ?? null)}</span>
              <span>Out: {formatTime(today?.check_out_at ?? null)}</span>
              <span>Worked: {formatHours(today?.worked_minutes ?? null)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {today && (
            <Badge variant={today.status === "present" ? "success" : today.status === "half_day" ? "warning" : "secondary"}>
              {today.status === "half_day" ? "Half day" : today.status === "present" ? "Present" : today.status === "leave" ? "Leave" : "Absent"}
            </Badge>
          )}
          {!isOnLeave && !hasCheckedIn && (
            <Button onClick={handleCheckIn} disabled={pending}>
              <LogIn /> Check in
            </Button>
          )}
          {!isOnLeave && hasCheckedIn && !hasCheckedOut && (
            <Button onClick={handleCheckOut} disabled={pending} variant="outline">
              <LogOut /> Check out
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
