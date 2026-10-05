import { z } from "zod";

export const contributionSchema = z.object({
  contributionCode: z
    .string()
    .trim()
    .min(1, "Contribution code is required")
    .max(50),

  contributionName: z
    .string()
    .trim()
    .min(1, "Contribution name is required")
    .max(200),

  description: z
    .string()
    .optional(),

  contributionType: z
    .string()
    .trim()
    .min(1, "Contribution type is required"),

  isActive: z.boolean(),
});

export type ContributionFormValues =
  z.infer<typeof contributionSchema>;