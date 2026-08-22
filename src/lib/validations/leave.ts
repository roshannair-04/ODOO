import { z } from "zod";

export const applyLeaveSchema = z
  .object({
    leaveTypeId: z.string().uuid("Pick a leave type"),
    startDate: z.string().min(1, "Pick a start date"),
    endDate: z.string().min(1, "Pick an end date"),
    isHalfDay: z.boolean(),
    reason: z.string().trim().max(300).optional().or(z.literal("")),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: "End date cannot be before the start date.",
    path: ["endDate"],
  })
  .refine((v) => !v.isHalfDay || v.startDate === v.endDate, {
    message: "A half-day request must have the same start and end date.",
    path: ["isHalfDay"],
  });
export type ApplyLeaveInput = z.infer<typeof applyLeaveSchema>;

export const decideLeaveSchema = z.object({
  requestId: z.string().uuid(),
  comment: z.string().trim().max(300).optional().or(z.literal("")),
});
export type DecideLeaveInput = z.infer<typeof decideLeaveSchema>;
