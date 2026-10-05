const TYPE_LIST = "/hr/employee-document-types";
const CATEGORY_LIST = "/hr/employee-document-categories";
const DOCUMENT_LIST = "/hr/employee-documents";

const ALLOWED_RETURN_PREFIXES = [
  TYPE_LIST,
  CATEGORY_LIST,
  DOCUMENT_LIST,
] as const;

/**
 * Safe in-app return path for Document Type create/edit (DOC-001).
 */
export function resolveEmployeeDocumentTypeReturnPath(
  returnParam: string | null | undefined,
  fallback: string = TYPE_LIST,
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

export function employeeDocumentTypeCreateHref(options?: {
  returnTo?: string;
}): string {
  const params = new URLSearchParams();
  if (options?.returnTo) params.set("return", options.returnTo);
  const query = params.toString();
  return query ? `${TYPE_LIST}/new?${query}` : `${TYPE_LIST}/new`;
}

export function employeeDocumentTypeEditHref(
  id: string,
  options?: { returnTo?: string },
): string {
  const params = new URLSearchParams();
  if (options?.returnTo) params.set("return", options.returnTo);
  const query = params.toString();
  const base = `${TYPE_LIST}/${id}/edit`;
  return query ? `${base}?${query}` : base;
}

export { TYPE_LIST as EMPLOYEE_DOCUMENT_TYPE_LIST };
