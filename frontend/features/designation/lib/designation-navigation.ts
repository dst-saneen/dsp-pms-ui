const DESIGNATION_LIST = "/administration/designations";
const ONBOARDING_TEMPLATES = "/hr/onboarding-templates";

const ALLOWED_RETURN_PREFIXES = [
  DESIGNATION_LIST,
  ONBOARDING_TEMPLATES,
] as const;

/**
 * Safe in-app return path for Designation create/edit (DES-03).
 * Rejects absolute URLs and paths outside allowlisted modules.
 */
export function resolveDesignationReturnPath(
  returnParam: string | null | undefined,
  source: string | null | undefined,
  fallback: string = DESIGNATION_LIST,
): string {
  const candidate = (returnParam ?? "").trim();
  if (
    candidate.startsWith("/") &&
    !candidate.startsWith("//") &&
    !candidate.includes("://") &&
    ALLOWED_RETURN_PREFIXES.some(
      (prefix) => candidate === prefix || candidate.startsWith(`${prefix}/`),
    )
  ) {
    return candidate;
  }

  if (source === "onboarding-templates") {
    return ONBOARDING_TEMPLATES;
  }

  return fallback;
}

export function designationCreateHref(options?: {
  source?: "designations" | "onboarding-templates";
  returnTo?: string;
}): string {
  const params = new URLSearchParams();
  if (options?.source) params.set("source", options.source);
  if (options?.returnTo) params.set("return", options.returnTo);
  const query = params.toString();
  return query
    ? `${DESIGNATION_LIST}/new?${query}`
    : `${DESIGNATION_LIST}/new`;
}

export function designationEditHref(
  id: string,
  options?: { source?: string; returnTo?: string },
): string {
  const params = new URLSearchParams();
  if (options?.source) params.set("source", options.source);
  if (options?.returnTo) params.set("return", options.returnTo);
  const query = params.toString();
  const base = `${DESIGNATION_LIST}/${id}/edit`;
  return query ? `${base}?${query}` : base;
}

export function designationChecklistHref(onboardingTemplateId: string) {
  return `${ONBOARDING_TEMPLATES}/${onboardingTemplateId}`;
}

export { DESIGNATION_LIST, ONBOARDING_TEMPLATES };
