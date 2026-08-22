import type { Metadata } from "next";
import { CalendarClock } from "lucide-react";
import { ComingSoon } from "@/components/site/coming-soon";

export const metadata: Metadata = {
  title: "Leave",
  description: "Apply for leave and track approval status.",
};

export default function LeavePage() {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-xl font-semibold">Leave</h1>
      <p className="mb-4 text-sm text-muted-foreground">Apply for time off and track approvals.</p>
      <ComingSoon
        icon={CalendarClock}
        title="Leave management lands in the next phase"
        description="Applying for leave, balances, and the approval queue are being built next."
      />
    </div>
  );
}
