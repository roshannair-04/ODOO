import { z } from "zod";

// Admin manual correction on an employee's attendance row for a given date.
export const attendanceCorrectionSchema = z.object({
  employeeId: z.string().uuid(),
  date: z.string().min(1, "Pick a date"),
  status: z.enum(["present", "absent", "half_day", "leave"]),
  checkInTime: z.string().optional().or(z.literal("")),
  checkOutTime: z.string().optional().or(z.literal("")),
  note: z.string().trim().max(300).optional().or(z.literal("")),
});
export type AttendanceCorrectionInput = z.infer<typeof attendanceCorrectionSchema>;
