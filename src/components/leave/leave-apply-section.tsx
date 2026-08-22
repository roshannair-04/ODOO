"use client";

import { useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ApplyLeaveDialog, type ApplyLeaveDialogHandle, type LeaveTypeOption } from "@/components/leave/apply-leave-dialog";
import { parseNaturalLeaveText, type ParsedLeaveRequest } from "@/lib/nl-leave-parser";
import { formatDate } from "@/lib/utils";

export function LeaveApplySection({ leaveTypes }: { leaveTypes: LeaveTypeOption[] }) {
  const dialogRef = useRef<ApplyLeaveDialogHandle>(null);
  const [nlText, setNlText] = useState("");
  const [preview, setPreview] = useState<ParsedLeaveRequest | null>(null);

  function handleParse() {
    if (!nlText.trim()) return;
    setPreview(parseNaturalLeaveText(nlText, leaveTypes));
  }

  function handleReview() {
    if (!preview) return;
    dialogRef.current?.openWithValues({
      leaveTypeId: preview.leaveTypeId ?? leaveTypes[0]?.id ?? "",
      startDate: preview.startDate ?? "",
      endDate: preview.endDate ?? preview.startDate ?? "",
      isHalfDay: preview.isHalfDay,
      reason: preview.reason,
    });
    setPreview(null);
    setNlText("");
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Sparkles className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={nlText}
            onChange={(e) => {
              setNlText(e.target.value);
              if (preview) setPreview(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleParse();
              }
            }}
            placeholder="Try “sick leave next Monday and Tuesday” — or apply manually →"
            className="pl-8"
          />
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={handleParse} disabled={!nlText.trim()}>
            Parse
          </Button>
          <ApplyLeaveDialog ref={dialogRef} leaveTypes={leaveTypes} />
        </div>
      </div>

      {preview &&
        (preview.understood ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Understood:</span>
            <span className="font-medium">{preview.leaveTypeName ?? "leave type not detected"}</span>
            <span className="text-muted-foreground">·</span>
            <span className="font-medium">
              {preview.startDate ? formatDate(preview.startDate) : "—"}
              {preview.endDate && preview.endDate !== preview.startDate ? ` – ${formatDate(preview.endDate)}` : ""}
              {preview.isHalfDay ? " (half day)" : ""}
            </span>
            <Button type="button" size="sm" className="ml-auto" onClick={handleReview}>
              Review &amp; submit
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Couldn&apos;t find a date in that — try something like &quot;casual leave this Friday&quot;, or use{" "}
            <span className="font-medium text-foreground">Apply for leave</span> directly.
          </p>
        ))}
    </div>
  );
}
