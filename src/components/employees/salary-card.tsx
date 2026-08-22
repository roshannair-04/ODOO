"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Wallet, Pencil } from "lucide-react";
import { setSalarySchema, type SetSalaryInput } from "@/lib/validations/salary";
import { setSalaryAction } from "@/app/actions/salary";
import { formatMoney, formatDate } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export interface CurrentSalary {
  basic: number;
  hra: number;
  allowances: number;
  deductions: number;
  effective_from: string;
}

export function SalaryCard({ employeeId, current }: { employeeId: string; current: CurrentSalary | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SetSalaryInput>({
    resolver: zodResolver(setSalarySchema),
    defaultValues: {
      basic: current?.basic ?? 0,
      hra: current?.hra ?? 0,
      allowances: current?.allowances ?? 0,
      deductions: current?.deductions ?? 0,
    },
  });

  async function onSubmit(values: SetSalaryInput) {
    setSubmitting(true);
    const result = await setSalaryAction(employeeId, values);
    setSubmitting(false);

    if (result.ok) {
      toast.success(result.message);
      setOpen(false);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  }

  const gross = current ? current.basic + current.hra + current.allowances : 0;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div className="flex flex-col gap-1">
          <CardTitle className="flex items-center gap-2">
            <Wallet className="size-4 text-muted-foreground" />
            Salary structure
          </CardTitle>
          {current && (
            <CardDescription>Effective {formatDate(current.effective_from)}.</CardDescription>
          )}
        </div>
        <Dialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) reset();
          }}
        >
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Pencil /> {current ? "Update" : "Set salary"}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>{current ? "Update salary structure" : "Set salary structure"}</DialogTitle>
                <DialogDescription>
                  Effective today. Past payslips already generated aren&apos;t affected — only payroll runs from
                  today onward use this.
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="basic">Basic (monthly)</Label>
                  <Input id="basic" type="number" min={0} step="0.01" invalid={!!errors.basic} {...register("basic", { valueAsNumber: true })} />
                  {errors.basic && <p className="text-xs text-destructive">{errors.basic.message}</p>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="hra">HRA</Label>
                  <Input id="hra" type="number" min={0} step="0.01" invalid={!!errors.hra} {...register("hra", { valueAsNumber: true })} />
                  {errors.hra && <p className="text-xs text-destructive">{errors.hra.message}</p>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="allowances">Allowances</Label>
                  <Input
                    id="allowances"
                    type="number"
                    min={0}
                    step="0.01"
                    invalid={!!errors.allowances}
                    {...register("allowances", { valueAsNumber: true })}
                  />
                  {errors.allowances && <p className="text-xs text-destructive">{errors.allowances.message}</p>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="deductions">Deductions</Label>
                  <Input
                    id="deductions"
                    type="number"
                    min={0}
                    step="0.01"
                    invalid={!!errors.deductions}
                    {...register("deductions", { valueAsNumber: true })}
                  />
                  {errors.deductions && <p className="text-xs text-destructive">{errors.deductions.message}</p>}
                </div>
              </div>

              <DialogFooter className="justify-end gap-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Saving…" : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 pt-0 sm:grid-cols-4">
        {current ? (
          <>
            <Stat label="Basic" value={formatMoney(current.basic)} />
            <Stat label="HRA" value={formatMoney(current.hra)} />
            <Stat label="Allowances" value={formatMoney(current.allowances)} />
            <Stat label="Deductions" value={formatMoney(current.deductions)} />
            <div className="col-span-2 border-t border-border pt-3 sm:col-span-4">
              <Stat label="Gross (monthly)" value={formatMoney(gross)} emphasis />
            </div>
          </>
        ) : (
          <p className="col-span-2 py-2 text-sm text-muted-foreground sm:col-span-4">
            No salary set yet — payroll can&apos;t be generated for this employee until one is.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className={emphasis ? "text-body-lg font-semibold tabular-nums" : "text-sm font-medium tabular-nums"}>
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
