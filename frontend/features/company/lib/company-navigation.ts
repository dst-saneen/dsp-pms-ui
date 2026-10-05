const COMPANY_LIST = "/administration/companies";

const ALLOWED_RETURN_PREFIXES = [
  COMPANY_LIST,
  "/administration/branches",
  "/administration/departments",
  "/administration/company-groups",
] as const;

export function resolveCompanyReturnPath(
  returnParam: string | null | undefined,
  fallback: string = COMPANY_LIST,
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
  return fallback;
}

export function companyCreateHref(options?: { returnTo?: string }): string {
  const params = new URLSearchParams();
  if (options?.returnTo) params.set("return", options.returnTo);
  const query = params.toString();
  return query ? `${COMPANY_LIST}/new?${query}` : `${COMPANY_LIST}/new`;
}

export function companyEditHref(
  id: string,
  options?: { returnTo?: string },
): string {
  const params = new URLSearchParams();
  if (options?.returnTo) params.set("return", options.returnTo);
  const query = params.toString();
  const base = `${COMPANY_LIST}/${id}/edit`;
  return query ? `${base}?${query}` : base;
}

export function companyModulesHref(id: string): string {
  return `${COMPANY_LIST}/${id}/modules`;
}

export { COMPANY_LIST };
