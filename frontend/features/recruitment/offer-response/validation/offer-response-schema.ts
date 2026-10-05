import { z } from "zod";

export const offerAcceptanceSchema = z.object({
  legalName: z.string().trim().min(1, "Enter your full legal name"),
  acknowledgement: z
    .boolean()
    .refine((value) => value === true, "You must acknowledge the offer terms"),
});

export type OfferAcceptanceFormValues = z.infer<typeof offerAcceptanceSchema>;

export const offerDeclineSchema = z.object({
  legalName: z.string().trim().min(1, "Enter your full legal name"),
  acknowledgement: z
    .boolean()
    .refine((value) => value === true, "Confirmation is required to decline"),
  reason: z.string().optional(),
});

export type OfferDeclineFormValues = z.infer<typeof offerDeclineSchema>;
