/**
 * EMP-001 — URL-persisted Employees directory filters.
 */

export const EMPLOYEE_LIST = "/hr/employees";

const ALLOWED_SORT = new Set([
  "firstName",
  "lastName",
  "employeeCode",
  "employmentStatus",
  "joiningDate",
  "createdAt",
  "updatedAt",
]);

export interface EmployeeDirectoryFilters {
  search: string;
  companyId: string;
  branchId: string;
  departmentId: string;
  employmentStatus: string;
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: "asc" | "desc";
}

export const DEFAULT_EMPLOYEE_DIRECTORY_FILTERS: EmployeeDirectoryFilters = {
  search: "",
  companyId: "",
  branchId: "",
  departmentId: "",
  employmentStatus: "",
  page: 1,
  limit: 10,
  sortBy: "firstName",
  sortOrder: "asc",
};

export function parseEmployeeDirectoryFilters(
  params: URLSearchParams,
): EmployeeDirectoryFilters {
  const page = Number(params.get("page") ?? "1");
  const limit = Number(params.get("limit") ?? "10");
  const sortByRaw = params.get("sortBy") ?? "firstName";
  const sortOrderRaw = (params.get("sortOrder") ?? "asc").toLowerCase();

  return {
    search: params.get("q") ?? "",
    companyId: params.get("companyId") ?? "",
    branchId: params.get("branchId") ?? "",
    departmentId: params.get("departmentId") ?? "",
    employmentStatus: params.get("status") ?? "",
    page: Number.isFinite(page) && page > 0 ? page : 1,
    limit:
      Number.isFinite(limit) && limit > 0 && limit <= 100 ? limit : 10,
    sortBy: ALLOWED_SORT.has(sortByRaw) ? sortByRaw : "firstName",
    sortOrder: sortOrderRaw === "desc" ? "desc" : "asc",
  };
}

export function employeeDirectoryQueryString(
  filters: EmployeeDirectoryFilters,
): string {
  const params = new URLSearchParams();
  if (filters.search.trim()) params.set("q", filters.search.trim());
  if (filters.companyId) params.set("companyId", filters.companyId);
  if (filters.branchId) params.set("branchId", filters.branchId);
  if (filters.departmentId) params.set("departmentId", filters.departmentId);
  if (filters.employmentStatus)
    params.set("status", filters.employmentStatus);
  if (filters.page > 1) params.set("page", String(filters.page));
  if (filters.limit !== 10) params.set("limit", String(filters.limit));
  if (filters.sortBy !== "firstName") params.set("sortBy", filters.sortBy);
  if (filters.sortOrder !== "asc") params.set("sortOrder", filters.sortOrder);
  return params.toString();
}

export function employeeDirectoryHref(
  filters: EmployeeDirectoryFilters = DEFAULT_EMPLOYEE_DIRECTORY_FILTERS,
): string {
  const query = employeeDirectoryQueryString(filters);
  return query ? `${EMPLOYEE_LIST}?${query}` : EMPLOYEE_LIST;
}

export function employeeDetailHref(
  id: string,
  returnTo?: string,
): string {
  const params = new URLSearchParams();
  if (returnTo) params.set("return", returnTo);
  const query = params.toString();
  return query
    ? `${EMPLOYEE_LIST}/${id}?${query}`
    : `${EMPLOYEE_LIST}/${id}`;
}

export function employeeEditHref(id: string, returnTo?: string): string {
  const params = new URLSearchParams();
  if (returnTo) params.set("return", returnTo);
  const query = params.toString();
  return query
    ? `${EMPLOYEE_LIST}/${id}/edit?${query}`
    : `${EMPLOYEE_LIST}/${id}/edit`;
}

export function employeeCreateHref(returnTo?: string): string {
  const params = new URLSearchParams();
  if (returnTo) params.set("return", returnTo);
  const query = params.toString();
  return query ? `${EMPLOYEE_LIST}/new?${query}` : `${EMPLOYEE_LIST}/new`;
}

export function resolveEmployeeReturnPath(
  returnParam: string | null | undefined,
  fallback: string = EMPLOYEE_LIST,
): string {
  const candidate = (returnParam ?? "").trim();
  if (
    candidate.startsWith("/") &&
    !candidate.startsWith("//") &&
    !candidate.includes("://") &&
    (candidate === EMPLOYEE_LIST ||
      candidate.startsWith(`${EMPLOYEE_LIST}?`) ||
      /^\/hr\/employees\/[^/?#]+$/.test(candidate))
  ) {
    return candidate;
  }
  return fallback;
}

export function toEmployeeSearchParams(filters: EmployeeDirectoryFilters) {
  return {
    search: filters.search.trim() || undefined,
    companyId: filters.companyId || undefined,
    branchId: filters.branchId || undefined,
    departmentId: filters.departmentId || undefined,
    employmentStatus: filters.employmentStatus || undefined,
    page: filters.page,
    limit: filters.limit,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  };
}
