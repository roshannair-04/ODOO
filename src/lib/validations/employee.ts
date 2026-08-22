import { z } from "zod";

// Fields every employee may edit on their own profile (brief 3.3.2).
export const selfEditSchema = z.object({
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  address: z.string().trim().max(300).optional().or(z.literal("")),
});
export type SelfEditInput = z.infer<typeof selfEditSchema>;

// Fields an admin may additionally edit on any employee (brief 3.3.2).
export const adminEditSchema = selfEditSchema.extend({
  fullName: z.string().trim().min(2, "Enter a full name"),
  designation: z.string().trim().max(100).optional().or(z.literal("")),
  departmentId: z.string().uuid().optional().or(z.literal("")),
  managerId: z.string().uuid().optional().or(z.literal("")),
  status: z.enum(["active", "inactive"]),
  role: z.enum(["admin", "employee"]),
  dateOfJoining: z.string().min(1, "Pick a date"),
});
export type AdminEditInput = z.infer<typeof adminEditSchema>;
