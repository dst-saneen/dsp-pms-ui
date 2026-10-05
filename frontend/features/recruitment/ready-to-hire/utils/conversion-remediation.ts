import { RECRUITMENT_ROUTES } from "../../constants/routes";

/** Soft-link targets for blocked/warning conversion preflight checks. */
export interface ConversionRemediationLink {
  href: string;
  label: string;
}

export interface ConversionRemediationContext {
  applicationId: string;
  jobOpeningId?: string;
  acceptedOfferId?: string;
  candidateId?: string;
  existingEmployeeId?: string;
  userId?: string;
}

/**
 * Map preflight check codes (FE mock + BE live) to remediation destinations.
 */
export function resolveConversionRemediation(
  code: string,
  context: ConversionRemediationContext,
): ConversionRemediationLink | null {
  switch (code) {
    case "OFFER_ACCEPTED":
    case "SIGNED_OFFER_VERIFIED":
    case "MANAGER_ACTIVE":
      return {
        href: `${RECRUITMENT_ROUTES.applications.detail(context.applicationId)}?tab=offer`,
        label: "Open offer",
      };

    case "POSITION_RESERVED":
    case "HEADCOUNT_RESERVED":
      return context.jobOpeningId
        ? {
            href: RECRUITMENT_ROUTES.openings.detail(context.jobOpeningId),
            label: "Open job opening",
          }
        : {
            href: RECRUITMENT_ROUTES.openings.list,
            label: "View openings",
          };

    case "CANDIDATE_EMAIL_AVAILABLE":
    case "CANDIDATE_EMAIL_VALID":
      return context.candidateId
        ? {
            href: RECRUITMENT_ROUTES.candidates.detail(context.candidateId),
            label: "Open candidate",
          }
        : {
            href: RECRUITMENT_ROUTES.applications.detail(context.applicationId),
            label: "Open application",
          };

    case "ORGANIZATION_ACTIVE":
      return {
        href: "/administration/designations",
        label: "Review designations",
      };

    case "ONBOARDING_TEMPLATE_RESOLVED":
    case "ONBOARDING_TEMPLATE_CONFIGURED":
      return {
        href: "/hr/onboarding-templates",
        label: "Onboarding templates",
      };

    case "DOCUMENT_TYPE_MAPPING":
      return {
        href: "/hr/employee-document-types",
        label: "Document type mappings",
      };

    case "IDENTITY_AVAILABLE":
    case "NO_CONFLICTING_USER":
    case "CANDIDATE_NOT_ALREADY_EMPLOYEE":
      return {
        href: "/administration/users",
        label: "User administration",
      };

    case "NOT_ALREADY_CONVERTED":
    case "ALREADY_CONVERTED":
      return context.existingEmployeeId
        ? {
            href: RECRUITMENT_ROUTES.employeeDetail(
              context.existingEmployeeId,
              "onboarding",
            ),
            label: "View employee",
          }
        : null;

    default:
      return null;
  }
}

export function employeeOnboardingHref(onboardingId: string) {
  return `/hr/employee-onboarding/${onboardingId}`;
}

export function usersAdminHref(userId?: string) {
  return userId
    ? `/administration/users?userId=${encodeURIComponent(userId)}`
    : "/administration/users";
}
