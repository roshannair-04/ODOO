"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, Lock } from "lucide-react";
import { generatePayrollAction, finalizePayrollAction } from "@/app/actions/payroll";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function PayrollControls({
  month,
  year,
  hasDrafts,
  hasAny,
  maxMonth,
}: {
  month: number;
  year: number;
  hasDrafts: boolean;
  hasAny: boolean;
  /** "YYYY-MM" for the current month — payroll can't be generated for anything later, since it's derived from attendance that hasn't happened yet. */
  maxMonth: string;
}) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  function setMonth(value: string) {
    // value is "YYYY-MM" from <input type="month">
    const [y, m] = value.split("-");
    if (!y || !m) return;
    router.push(`/payroll?month=${Number(m)}&year=${y}`);
  }

  async function handleGenerate() {
    setGenerating(true);
    const result = await generatePayrollAction({ month, year });
    setGenerating(false);
    if (result.ok) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  }

  async function handleFinalize() {
    setFinalizing(true);
    const result = await finalizePayrollAction({ month, year });
    setFinalizing(false);
    if (result.ok) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="payroll-month" className="sr-only">
          Month
        </Label>
        <Input
          id="payroll-month"
          type="month"
          value={`${year}-${String(month).padStart(2, "0")}`}
          onChange={(e) => setMonth(e.target.value)}
          max={maxMonth}
          className="sm:w-44"
        />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={handleGenerate} disabled={generating}>
          <Sparkles /> {generating ? "Generating…" : hasAny ? "Regenerate drafts" : "Generate payroll"}
        </Button>
        <Button onClick={handleFinalize} disabled={finalizing || !hasDrafts}>
          <Lock /> {finalizing ? "Finalizing…" : "Finalize month"}
        </Button>
      </div>
    </div>
  );
}
