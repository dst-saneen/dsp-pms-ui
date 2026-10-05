import { z } from "zod";

export const branchSchema = z.object({
  companyId: z.string().min(1, "Company is required"),
  branchName: z.string().min(1, "Branch Name is required"),
  addressLine1: z.string(),
  addressLine2: z.string(),
  city: z.string(),
  state: z.string(),
  postalCode: z.string(),
  countryCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "Use a two-letter ISO country code"),
  countrySubdivisionCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}-[A-Z0-9]{1,3}$/, "Use an ISO 3166-2 subdivision code"),
  timezone: z.string().trim().min(1, "Timezone is required").refine((value) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Use a valid IANA timezone"),
  isActive: z.boolean(),
});

export type BranchFormValues = z.infer<typeof branchSchema>;

export function toBranchPayload(
  data: BranchFormValues,
) {
  const emptyToUndefined = (value?: string) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  };

  return {
    companyId: data.companyId,
    branchName: data.branchName.trim(),
    addressLine1: emptyToUndefined(data.addressLine1),
    addressLine2: emptyToUndefined(data.addressLine2),
    city: emptyToUndefined(data.city),
    state: emptyToUndefined(data.state),
    postalCode: emptyToUndefined(data.postalCode),
    countryCode: data.countryCode.trim().toUpperCase(),
    countrySubdivisionCode: data.countrySubdivisionCode.trim().toUpperCase(),
    timezone: data.timezone.trim(),
    isActive: data.isActive,
  };
}
