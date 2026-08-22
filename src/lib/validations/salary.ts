import { z } from "zod";

// Admin-only: set an employee's salary structure. Inserted as a new
// versioned row (effective_from) — payroll always reads the latest row
// effective on or before the month it's generating, so past payslips
// stay correct even after a raise.
export const setSalarySchema = z.object({
  basic: z.number().min(0, "Must be 0 or more"),
  hra: z.number().min(0, "Must be 0 or more"),
  allowances: z.number().min(0, "Must be 0 or more"),
  deductions: z.number().min(0, "Must be 0 or more"),
});
export type SetSalaryInput = z.infer<typeof setSalarySchema>;
