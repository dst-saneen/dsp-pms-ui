const DEPARTMENT_LIST = "/administration/departments";

const ALLOWED_RETURN_PREFIXES = [
  DEPARTMENT_LIST,
  "/administration/branches",
  "/administration/companies",
  "/administration/designations",
] as const;

export function resolveDepartmentReturnPath(
  returnParam: string | null | undefined,
  fallback: string = DEPARTMENT_LIST,
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

export function departmentCreateHref(options?: {
  returnTo?: string;
  companyId?: string;
  branchId?: string;
}): string {
  const params = new URLSearchParams();
  if (options?.returnTo) params.set("return", options.returnTo);
  if (options?.companyId) params.set("companyId", options.companyId);
  if (options?.branchId) params.set("branchId", options.branchId);
  const query = params.toString();
  return query ? `${DEPARTMENT_LIST}/new?${query}` : `${DEPARTMENT_LIST}/new`;
}

export function departmentEditHref(
  id: string,
  options?: { returnTo?: string },
): string {
  const params = new URLSearchParams();
  if (options?.returnTo) params.set("return", options.returnTo);
  const query = params.toString();
  const base = `${DEPARTMENT_LIST}/${id}/edit`;
  return query ? `${base}?${query}` : base;
}

export { DEPARTMENT_LIST };
