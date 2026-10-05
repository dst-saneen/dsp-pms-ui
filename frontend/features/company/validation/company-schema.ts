import { z } from "zod";

export const companySchema = z.object({
  companyGroupId: z
    .string()
    .uuid()
    .optional()
    .or(z.literal("")),

  companyName: z
    .string()
    .min(1, "Company Name is required"),

  registrationNo: z
    .string()
    .optional(),

  taxNumber: z
    .string()
    .optional(),

  legalCountryCode: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .pipe(z.string().regex(/^[A-Z]{2}$/, "Use a two-letter ISO country code")),

  parentCompanyId: z
    .string()
    .uuid()
    .optional()
    .or(z.literal("")),

  isActive: z.boolean(),
});

export type CompanyFormValues = z.infer<
  typeof companySchema
>;
