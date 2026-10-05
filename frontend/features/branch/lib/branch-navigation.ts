const BRANCH_LIST = "/administration/branches";

const ALLOWED_RETURN_PREFIXES = [
  BRANCH_LIST,
  "/administration/companies",
  "/administration/departments",
] as const;

export function resolveBranchReturnPath(
  returnParam: string | null | undefined,
  fallback: string = BRANCH_LIST,
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

export function branchCreateHref(options?: {
  returnTo?: string;
  companyId?: string;
}): string {
  const params = new URLSearchParams();
  if (options?.returnTo) params.set("return", options.returnTo);
  if (options?.companyId) params.set("companyId", options.companyId);
  const query = params.toString();
  return query ? `${BRANCH_LIST}/new?${query}` : `${BRANCH_LIST}/new`;
}

export function branchEditHref(
  id: string,
  options?: { returnTo?: string },
): string {
  const params = new URLSearchParams();
  if (options?.returnTo) params.set("return", options.returnTo);
  const query = params.toString();
  const base = `${BRANCH_LIST}/${id}/edit`;
  return query ? `${base}?${query}` : base;
}

export function branchWorkingDaysHref(branchId: string): string {
  return `${BRANCH_LIST}?workingDays=${encodeURIComponent(branchId)}`;
}

export { BRANCH_LIST };
