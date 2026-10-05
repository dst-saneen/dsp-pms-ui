const DOCUMENT_LIST = "/hr/employee-documents";
const TYPE_LIST = "/hr/employee-document-types";
const CATEGORY_LIST = "/hr/employee-document-categories";

const ALLOWED_RETURN_PREFIXES = [
  DOCUMENT_LIST,
  TYPE_LIST,
  CATEGORY_LIST,
  "/hr/employees",
] as const;

/**
 * Safe in-app return path for Employee Document create/edit (DOC-001).
 */
export function resolveEmployeeDocumentReturnPath(
  returnParam: string | null | undefined,
  fallback: string = DOCUMENT_LIST,
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

export function employeeDocumentCreateHref(options?: {
  returnTo?: string;
  employeeId?: string;
}): string {
  const params = new URLSearchParams();
  if (options?.returnTo) params.set("return", options.returnTo);
  if (options?.employeeId) params.set("employeeId", options.employeeId);
  const query = params.toString();
  return query ? `${DOCUMENT_LIST}/new?${query}` : `${DOCUMENT_LIST}/new`;
}

export function employeeDocumentDetailHref(
  id: string,
  options?: { returnTo?: string },
): string {
  const params = new URLSearchParams();
  if (options?.returnTo) params.set("return", options.returnTo);
  const query = params.toString();
  const base = `${DOCUMENT_LIST}/${id}`;
  return query ? `${base}?${query}` : base;
}

export function employeeDocumentEditHref(
  id: string,
  options?: { returnTo?: string },
): string {
  const params = new URLSearchParams();
  if (options?.returnTo) params.set("return", options.returnTo);
  const query = params.toString();
  const base = `${DOCUMENT_LIST}/${id}/edit`;
  return query ? `${base}?${query}` : base;
}

export { DOCUMENT_LIST as EMPLOYEE_DOCUMENT_LIST };
