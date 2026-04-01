import { z } from "zod";

export const analyticsRangeSchema = z.enum(["7d", "30d", "90d"]).default("30d");

export const analyticsQuerySchema = z.object({
  range: analyticsRangeSchema.optional(),
});

export type AnalyticsQuerySchema = z.infer<typeof analyticsQuerySchema>;
