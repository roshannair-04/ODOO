import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");

// Admin manual correction on an employee's attendance row for a given date.
export const attendanceCorrectionSchema = z.object({
  employeeId: z.string().uuid(),
  date: isoDate,
  status: z.enum(["present", "absent", "half_day", "leave"]),
  checkInTime: z.string().optional().or(z.literal("")),
  checkOutTime: z.string().optional().or(z.literal("")),
  note: z.string().trim().max(300).optional().or(z.literal("")),
});
export type AttendanceCorrectionInput = z.infer<typeof attendanceCorrectionSchema>;

export const markAllPresentSchema = z.object({
  date: isoDate,
});
export type MarkAllPresentInput = z.infer<typeof markAllPresentSchema>;
