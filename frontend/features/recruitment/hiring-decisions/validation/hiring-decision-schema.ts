import { z } from "zod";

export const hiringDecisionSchema = z.object({
  reasonCode: z.string().optional(),
  comment: z.string().trim().min(1, "A decision note is required"),
});

export type HiringDecisionFormValues = z.infer<typeof hiringDecisionSchema>;
