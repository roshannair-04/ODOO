import type { Metadata } from "next";
import { CalendarCheck } from "lucide-react";
import { ComingSoon } from "@/components/site/coming-soon";

export const metadata: Metadata = {
  title: "Attendance",
  description: "Daily and weekly check-in, check-out and attendance history.",
};

export default function AttendancePage() {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-xl font-semibold">Attendance</h1>
      <p className="mb-4 text-sm text-muted-foreground">Check in, check out, and review your attendance history.</p>
      <ComingSoon
        icon={CalendarCheck}
        title="Attendance tracking lands in the next phase"
        description="Check-in/out, daily and weekly views, and the connection to leave and payroll are being built next."
      />
    </div>
  );
}
