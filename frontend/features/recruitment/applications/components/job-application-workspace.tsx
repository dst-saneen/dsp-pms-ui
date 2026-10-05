"use client";

import {
  useCallback,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ClipboardList } from "lucide-react";

import { KpiCard } from "@/components/common/kpi-card";
import { KpiGrid } from "@/components/common/kpi-grid";
import { PageToolbar } from "@/components/common/page-toolbar";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import { LookupSelect } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBranches } from "@/features/lookups/hooks/use-lookups";
import { useAuth } from "@/providers/auth-provider";
import { getApiErrorMessage } from "@/services/api-client";

import { RECRUITMENT_PERMISSIONS } from "../../constants/permissions";
import { JOB_APPLICATION_STATUS } from "../../types/enums";
import { useJobOpenings } from "../../openings/hooks/use-job-openings";
import { InternalApplicationDialog } from "../dialogs/internal-application-dialog";
import { useJobApplications } from "../hooks/use-job-applications";
import {
  applicationDetailHref,
  applicationDirectoryHref,
  DEFAULT_APPLICATION_DIRECTORY_FILTERS,
  parseApplicationDirectoryFilters,
  toJobApplicationSearchParams,
  type ApplicationDirectoryFilters,
} from "../lib/application-navigation";
import { JobApplicationTable } from "./job-application-table";

const STATUS_OPTIONS = [
  { value: "ALL", label: "All statuses" },
  { value: JOB_APPLICATION_STATUS.APPLIED, label: "Applied" },
  { value: JOB_APPLICATION_STATUS.SHORTLISTED, label: "Shortlisted" },
  { value: JOB_APPLICATION_STATUS.SCREENING, label: "Screening" },
  { value: JOB_APPLICATION_STATUS.INTERVIEW, label: "Interview" },
  { value: JOB_APPLICATION_STATUS.MANAGER_REVIEW, label: "Manager review" },
  { value: JOB_APPLICATION_STATUS.SELECTED, label: "Selected" },
  { value: JOB_APPLICATION_STATUS.OFFER_SENT, label: "Offer sent" },
  { value: JOB_APPLICATION_STATUS.OFFER_ACCEPTED, label: "Offer accepted" },
  { value: JOB_APPLICATION_STATUS.HIRED, label: "Hired" },
  { value: JOB_APPLICATION_STATUS.REJECTED, label: "Rejected" },
  { value: JOB_APPLICATION_STATUS.WITHDRAWN, label: "Withdrawn" },
  { value: JOB_APPLICATION_STATUS.OFFER_DECLINED, label: "Offer declined" },
];

function ApplicationSearchDraft({
  initialSearch,
  children,
}: {
  initialSearch: string;
  children: (
    draftSearch: string,
    setDraftSearch: (value: string) => void,
  ) => ReactNode;
}) {
  const [draftSearch, setDraftSearch] = useState(initialSearch);
  return <>{children(draftSearch, setDraftSearch)}</>;
}

export function JobApplicationWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(RECRUITMENT_PERMISSIONS.manage);

  const filters = useMemo(
    () => parseApplicationDirectoryFilters(searchParams),
    [searchParams],
  );

  const [intakeOpen, setIntakeOpen] = useState(false);

  const openingsQuery = useJobOpenings();
  const branchesQuery = useBranches();

  const openingItems =
    openingsQuery.data?.map((opening) => ({
      id: opening.id,
      code: opening.openingCode,
      name: opening.title,
    })) ?? [];

  const replaceFilters = useCallback(
    (next: ApplicationDirectoryFilters) => {
      startTransition(() => {
        router.replace(applicationDirectoryHref(next));
      });
    },
    [router],
  );

  const patchFilters = useCallback(
    (patch: Partial<ApplicationDirectoryFilters>) => {
      const next = { ...filters, ...patch };
      if (!("page" in patch)) next.page = 1;
      replaceFilters(next);
    },
    [filters, replaceFilters],
  );

  const searchParamsForQuery = useMemo(
    () => toJobApplicationSearchParams(filters),
    [filters],
  );

  const { data, isLoading, error, refetch, isFetching } =
    useJobApplications(searchParamsForQuery);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const page = data?.page ?? filters.page;
  const limit = data?.limit ?? filters.limit;
  const totalPages = Math.max(1, Math.ceil(total / Math.max(limit, 1)));

  return (
    <WorkspaceShell>
      <p className="text-sm text-muted-foreground">
        Track each candidate&apos;s application from submission through hiring
        decisions. Filters stay in the URL so refresh keeps your view.
      </p>

      <KpiGrid columns={3}>
        <KpiCard
          title="Matching applications"
          value={isLoading ? "—" : total}
          icon={ClipboardList}
          density="compact"
        />
      </KpiGrid>

      <ApplicationSearchDraft key={filters.search} initialSearch={filters.search}>
        {(draftSearch, setDraftSearch) => (
          <PageToolbar>
        <div className="flex w-full flex-col gap-3">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <Input
              placeholder="Search application, candidate, opening…"
              value={draftSearch}
              onChange={(event) => setDraftSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  patchFilters({ search: draftSearch, page: 1 });
                }
              }}
            />
            <Select
              value={filters.status}
              onValueChange={(status) => patchFilters({ status, page: 1 })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <LookupSelect
              value={filters.jobOpeningId}
              onChange={(jobOpeningId) =>
                patchFilters({ jobOpeningId, page: 1 })
              }
              items={openingItems}
              loading={openingsQuery.isLoading}
              placeholder="Opening"
            />
            <LookupSelect
              value={filters.branchId}
              onChange={(branchId) => patchFilters({ branchId, page: 1 })}
              items={branchesQuery.data ?? []}
              loading={branchesQuery.isLoading}
              placeholder="Branch"
            />
          </div>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <Input
              type="date"
              aria-label="Submitted from"
              value={filters.submittedFrom}
              onChange={(event) =>
                patchFilters({ submittedFrom: event.target.value, page: 1 })
              }
            />
            <Input
              type="date"
              aria-label="Submitted to"
              value={filters.submittedTo}
              onChange={(event) =>
                patchFilters({ submittedTo: event.target.value, page: 1 })
              }
            />
            <div className="flex flex-wrap gap-2 md:col-span-2 xl:col-span-2 xl:justify-end">
              <Button
                variant="outline"
                onClick={() => patchFilters({ search: draftSearch, page: 1 })}
              >
                Apply search
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setDraftSearch("");
                  replaceFilters(DEFAULT_APPLICATION_DIRECTORY_FILTERS);
                }}
              >
                Clear filters
              </Button>
              <Button
                variant="outline"
                onClick={() => void refetch()}
                disabled={isFetching}
              >
                {isFetching ? "Refreshing…" : "Refresh"}
              </Button>
              {canManage ? (
                <Button onClick={() => setIntakeOpen(true)}>
                  Internal entry
                </Button>
              ) : null}
            </div>
          </div>
        </div>
          </PageToolbar>
        )}
      </ApplicationSearchDraft>

      <JobApplicationTable
        data={items}
        isLoading={isLoading}
        error={
          error
            ? getApiErrorMessage(error, "We could not load applications.")
            : null
        }
        onRetry={() => void refetch()}
        onRowClick={(application) =>
          router.push(
            applicationDetailHref(application.id, {
              returnTo: applicationDirectoryHref(filters),
            }),
          )
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-muted-foreground">
          {total === 0
            ? "0 results"
            : `Showing ${(page - 1) * limit + 1}–${Math.min(page * limit, total)} of ${total}`}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || isLoading}
            onClick={() => patchFilters({ page: page - 1 })}
          >
            Previous
          </Button>
          <span className="text-muted-foreground">
            Page {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || isLoading}
            onClick={() => patchFilters({ page: page + 1 })}
          >
            Next
          </Button>
        </div>
      </div>

      <InternalApplicationDialog
        open={intakeOpen}
        onOpenChange={setIntakeOpen}
        onCreated={(applicationId) =>
          router.push(applicationDetailHref(applicationId))
        }
      />
    </WorkspaceShell>
  );
}
