const CATEGORY_LIST = "/hr/employee-document-categories";
const TYPE_LIST = "/hr/employee-document-types";
const DOCUMENT_LIST = "/hr/employee-documents";

const ALLOWED_RETURN_PREFIXES = [
  CATEGORY_LIST,
  TYPE_LIST,
  DOCUMENT_LIST,
] as const;

/**
 * Safe in-app return path for Document Category create/edit (DOC-001).
 */
export function resolveEmployeeDocumentCategoryReturnPath(
  returnParam: string | null | undefined,
  fallback: string = CATEGORY_LIST,
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

export function employeeDocumentCategoryCreateHref(options?: {
  returnTo?: string;
}): string {
  const params = new URLSearchParams();
  if (options?.returnTo) params.set("return", options.returnTo);
  const query = params.toString();
  return query ? `${CATEGORY_LIST}/new?${query}` : `${CATEGORY_LIST}/new`;
}

export function employeeDocumentCategoryEditHref(
  id: string,
  options?: { returnTo?: string },
): string {
  const params = new URLSearchParams();
  if (options?.returnTo) params.set("return", options.returnTo);
  const query = params.toString();
  const base = `${CATEGORY_LIST}/${id}/edit`;
  return query ? `${base}?${query}` : base;
}

export { CATEGORY_LIST as EMPLOYEE_DOCUMENT_CATEGORY_LIST };
