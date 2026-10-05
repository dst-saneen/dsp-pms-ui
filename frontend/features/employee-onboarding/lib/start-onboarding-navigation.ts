const EMPLOYEE_ONBOARDING_LIST = "/hr/employee-onboarding";
const ONBOARDING_TEMPLATES = "/hr/onboarding-templates";
const DESIGNATIONS = "/administration/designations";
const EMPLOYEES = "/hr/employees";

export function startEmployeeOnboardingHref(options?: {
  employeeId?: string;
  returnTo?: string;
}): string {
  const params = new URLSearchParams();
  if (options?.employeeId) {
    params.set("employeeId", options.employeeId);
  }
  if (options?.returnTo) {
    params.set("return", options.returnTo);
  }
  const query = params.toString();
  return query
    ? `${EMPLOYEE_ONBOARDING_LIST}/new?${query}`
    : `${EMPLOYEE_ONBOARDING_LIST}/new`;
}

export function resolveStartOnboardingReturnPath(
  returnParam: string | null | undefined,
): string {
  const candidate = (returnParam ?? "").trim();
  if (
    candidate.startsWith("/") &&
    !candidate.startsWith("//") &&
    !candidate.includes("://") &&
    (candidate === EMPLOYEE_ONBOARDING_LIST ||
      candidate.startsWith(`${EMPLOYEE_ONBOARDING_LIST}/`) ||
      candidate.startsWith(`${EMPLOYEES}/`))
  ) {
    return candidate;
  }
  return EMPLOYEE_ONBOARDING_LIST;
}

export type StartPreflightRemediation = {
  label: string;
  href: string;
};

export function remediationForStartBlocker(input: {
  code: string;
  entityId?: string;
  designationId?: string | null;
}): StartPreflightRemediation | null {
  switch (input.code) {
    case "ACTIVE_ONBOARDING_EXISTS":
      return {
        label: "Open active onboarding",
        href: input.entityId
          ? `${EMPLOYEE_ONBOARDING_LIST}/${input.entityId}`
          : EMPLOYEE_ONBOARDING_LIST,
      };
    case "ONBOARDING_TEMPLATE_NOT_CONFIGURED":
    case "ONBOARDING_TEMPLATE_NOT_PUBLISHED":
    case "ONBOARDING_TEMPLATE_BRANCH_MISMATCH":
    case "ONBOARDING_TEMPLATE_INVALID":
    case "ONBOARDING_TEMPLATE_NOT_FOUND":
      return {
        label: "Open Onboarding Templates",
        href: ONBOARDING_TEMPLATES,
      };
    case "DESIGNATION_OUT_OF_SCOPE":
      return {
        label: input.designationId
          ? "Edit designation"
          : "Open Designations",
        href: input.designationId
          ? `${DESIGNATIONS}/${input.designationId}/edit?source=onboarding-templates&return=${encodeURIComponent(ONBOARDING_TEMPLATES)}`
          : DESIGNATIONS,
      };
    case "EMPLOYEE_NOT_FOUND":
      return {
        label: "Open Employees",
        href: EMPLOYEES,
      };
    default:
      return null;
  }
}

export {
  EMPLOYEE_ONBOARDING_LIST,
  ONBOARDING_TEMPLATES,
  DESIGNATIONS,
  EMPLOYEES,
};
