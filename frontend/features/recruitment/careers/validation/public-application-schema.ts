import { z } from "zod";

export const publicApplicationSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  email: z.string().trim().email("Enter a valid email address"),
  mobile: z.string().optional(),
  coverNote: z.string().optional(),
  privacyAcknowledged: z
    .boolean()
    .refine((value) => value === true, "You must acknowledge the privacy notice"),
  website: z.string().optional(),
});

export type PublicApplicationFormValues = z.infer<typeof publicApplicationSchema>;
