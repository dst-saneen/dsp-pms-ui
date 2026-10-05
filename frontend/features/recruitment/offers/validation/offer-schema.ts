import { z } from "zod";

export const offerDraftSchema = z.object({
  roleTitle: z.string().trim().min(1, "Role title is required"),
  reportingManagerEmployeeId: z.string().uuid("Reporting manager is required"),
  employmentType: z.string().min(1, "Employment type is required"),
  joiningDate: z.string().min(1, "Joining date is required"),
  compensationAmount: z
    .number()
    .positive("Compensation must be greater than zero"),
  compensationCurrency: z.string().min(1, "Currency is required"),
  compensationPeriod: z.enum(["MONTHLY", "ANNUAL"]),
  probationDays: z.number().int().min(0, "Probation days cannot be negative"),
  expiryDate: z.string().min(1, "Offer expiry date is required"),
  terms: z.string().optional(),
});

export type OfferDraftFormValues = z.infer<typeof offerDraftSchema>;

export const revokeOfferSchema = z.object({
  reason: z.string().trim().min(1, "Revocation reason is required"),
});

export type RevokeOfferFormValues = z.infer<typeof revokeOfferSchema>;
