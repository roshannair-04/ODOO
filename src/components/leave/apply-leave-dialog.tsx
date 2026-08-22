"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { applyLeaveSchema, type ApplyLeaveInput } from "@/lib/validations/leave";
import { applyLeaveAction } from "@/app/actions/leave";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export interface LeaveTypeOption {
  id: string;
  name: string;
  is_paid: boolean;
}

export function ApplyLeaveDialog({ leaveTypes }: { leaveTypes: LeaveTypeOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<ApplyLeaveInput>({
    resolver: zodResolver(applyLeaveSchema),
    defaultValues: {
      leaveTypeId: leaveTypes[0]?.id ?? "",
      startDate: "",
      endDate: "",
      isHalfDay: false,
      reason: "",
    },
  });

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors },
  } = form;

  const isHalfDay = useWatch({ control, name: "isHalfDay" });
  const startDate = useWatch({ control, name: "startDate" });

  async function onSubmit(values: ApplyLeaveInput) {
    setSubmitting(true);
    const result = await applyLeaveAction(values);
    setSubmitting(false);

    if (result.ok) {
      toast.success(result.message);
      reset();
      setOpen(false);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus /> Apply for leave
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Apply for leave</DialogTitle>
            <DialogDescription>Your admin will be notified to review this request.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="leaveTypeId">Leave type</Label>
            <Select defaultValue={leaveTypes[0]?.id ?? ""} onValueChange={(v) => setValue("leaveTypeId", v)}>
              <SelectTrigger id="leaveTypeId">
                <SelectValue placeholder="Select a leave type" />
              </SelectTrigger>
              <SelectContent>
                {leaveTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name} {!type.is_paid && "(unpaid)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.leaveTypeId && <p className="text-xs text-destructive">{errors.leaveTypeId.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="startDate">Start date</Label>
              <Input id="startDate" type="date" invalid={!!errors.startDate} {...register("startDate")} />
              {errors.startDate && <p className="text-xs text-destructive">{errors.startDate.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="endDate">End date</Label>
              <Input
                id="endDate"
                type="date"
                invalid={!!errors.endDate}
                disabled={isHalfDay}
                {...register("endDate")}
              />
              {errors.endDate && <p className="text-xs text-destructive">{errors.endDate.message}</p>}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={isHalfDay}
              onCheckedChange={(checked) => {
                const value = checked === true;
                setValue("isHalfDay", value);
                if (value && startDate) setValue("endDate", startDate);
              }}
            />
            Half day
          </label>
          {errors.isHalfDay && <p className="text-xs text-destructive">{errors.isHalfDay.message}</p>}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Textarea id="reason" rows={2} placeholder="e.g. Family function" {...register("reason")} />
          </div>

          <DialogFooter className="justify-end gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
