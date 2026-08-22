import { z } from "zod";

export const monthYearSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
});
export type MonthYearInput = z.infer<typeof monthYearSchema>;
