import { z } from "zod";

export const internalApplicationSchema = z.object({
  jobOpeningId: z.string().uuid("Select a job opening"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Enter a valid email"),
  mobile: z.string().optional(),
  coverNote: z.string().optional(),
});

export type InternalApplicationFormValues = z.infer<
  typeof internalApplicationSchema
>;

export const applicationReasonSchema = z.object({
  reasonCode: z.string().optional(),
  comment: z.string().min(1, "Reason is required"),
});

export type ApplicationReasonFormValues = z.infer<typeof applicationReasonSchema>;
