/**
 * REC-004 — URL-persisted Applications directory filters + paging.
 */

import { JOB_APPLICATION_STATUS, type JobApplicationStatus } from "../../types/enums";
import type { JobApplicationSearch } from "../types/job-application";

export const APPLICATION_LIST = "/hr/recruitment/applications";

const ALLOWED_STATUSES = new Set<string>(Object.values(JOB_APPLICATION_STATUS));

export interface ApplicationDirectoryFilters {
  search: string;
  status: string;
  jobOpeningId: string;
  branchId: string;
  submittedFrom: string;
  submittedTo: string;
  page: number;
  limit: number;
}

export const DEFAULT_APPLICATION_DIRECTORY_FILTERS: ApplicationDirectoryFilters =
  {
    search: "",
    status: "ALL",
    jobOpeningId: "",
    branchId: "",
    submittedFrom: "",
    submittedTo: "",
    page: 1,
    limit: 20,
  };

export function parseApplicationDirectoryFilters(
  params: URLSearchParams,
): ApplicationDirectoryFilters {
  const page = Number(params.get("page") ?? "1");
  const limit = Number(params.get("limit") ?? "20");
  const statusRaw = params.get("status") ?? "ALL";

  return {
    search: params.get("q") ?? "",
    status:
      statusRaw === "ALL" || ALLOWED_STATUSES.has(statusRaw) ? statusRaw : "ALL",
    jobOpeningId: params.get("openingId") ?? "",
    branchId: params.get("branchId") ?? "",
    submittedFrom: params.get("from") ?? "",
    submittedTo: params.get("to") ?? "",
    page: Number.isFinite(page) && page > 0 ? page : 1,
    limit:
      Number.isFinite(limit) && limit > 0 && limit <= 100 ? limit : 20,
  };
}

export function applicationDirectoryQueryString(
  filters: ApplicationDirectoryFilters,
): string {
  const params = new URLSearchParams();
  if (filters.search.trim()) params.set("q", filters.search.trim());
  if (filters.status && filters.status !== "ALL") {
    params.set("status", filters.status);
  }
  if (filters.jobOpeningId) params.set("openingId", filters.jobOpeningId);
  if (filters.branchId) params.set("branchId", filters.branchId);
  if (filters.submittedFrom) params.set("from", filters.submittedFrom);
  if (filters.submittedTo) params.set("to", filters.submittedTo);
  if (filters.page > 1) params.set("page", String(filters.page));
  if (filters.limit !== 20) params.set("limit", String(filters.limit));
  return params.toString();
}

export function applicationDirectoryHref(
  filters: ApplicationDirectoryFilters = DEFAULT_APPLICATION_DIRECTORY_FILTERS,
): string {
  const query = applicationDirectoryQueryString(filters);
  return query ? `${APPLICATION_LIST}?${query}` : APPLICATION_LIST;
}

export function applicationDetailHref(
  id: string,
  options?: { tab?: string; returnTo?: string },
): string {
  const params = new URLSearchParams();
  if (options?.tab) params.set("tab", options.tab);
  if (options?.returnTo) params.set("return", options.returnTo);
  const query = params.toString();
  return query
    ? `${APPLICATION_LIST}/${id}?${query}`
    : `${APPLICATION_LIST}/${id}`;
}

export function toJobApplicationSearchParams(
  filters: ApplicationDirectoryFilters,
): JobApplicationSearch {
  return {
    search: filters.search.trim() || undefined,
    status:
      filters.status === "ALL"
        ? undefined
        : (filters.status as JobApplicationStatus),
    jobOpeningId: filters.jobOpeningId || undefined,
    branchId: filters.branchId || undefined,
    submittedFrom: filters.submittedFrom || undefined,
    submittedTo: filters.submittedTo || undefined,
    page: filters.page,
    limit: filters.limit,
  };
}
