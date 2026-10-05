"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, CirclePause, CirclePlus } from "lucide-react";

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
import { RECRUITMENT_ROUTES } from "../../constants/routes";
import { RECRUITMENT_PERMISSIONS } from "../../constants/permissions";
import { JOB_OPENING_STATUS } from "../../types/enums";
import {
  useBranches,
  useCompanies,
  useDepartments,
  useDesignations,
  useManagers,
} from "@/features/lookups/hooks/use-lookups";
import { useAuth } from "@/providers/auth-provider";
import { getApiErrorMessage } from "@/services/api-client";

import { useJobOpenings } from "../hooks/use-job-openings";
import type { JobOpeningSearch } from "../types/job-opening-search";
import { JobOpeningTable } from "./job-opening-table";

const STATUS_OPTIONS = [
  { value: "ALL", label: "All statuses" },
  { value: JOB_OPENING_STATUS.DRAFT, label: "Draft" },
  { value: JOB_OPENING_STATUS.OPEN, label: "Open" },
  { value: JOB_OPENING_STATUS.ON_HOLD, label: "On hold" },
  { value: JOB_OPENING_STATUS.FILLED, label: "Filled" },
  { value: JOB_OPENING_STATUS.CLOSED, label: "Closed" },
];

export function JobOpeningWorkspace() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(RECRUITMENT_PERMISSIONS.manage);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [companyId, setCompanyId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [designationId, setDesignationId] = useState("");
  const [hiringManagerEmployeeId, setHiringManagerEmployeeId] = useState("");

  const companiesQuery = useCompanies();
  const branchesQuery = useBranches(companyId || undefined);
  const departmentsQuery = useDepartments(branchId || undefined, {
    enabled: Boolean(branchId),
  });
  const designationsQuery = useDesignations(companyId || undefined);
  const managersQuery = useManagers(companyId || undefined);

  const filters = useMemo<JobOpeningSearch>(
    () => ({
      search: search.trim() || undefined,
      status: status === "ALL" ? undefined : (status as JobOpeningSearch["status"]),
      companyId: companyId || undefined,
      branchId: branchId || undefined,
      departmentId: departmentId || undefined,
      designationId: designationId || undefined,
      hiringManagerEmployeeId: hiringManagerEmployeeId || undefined,
    }),
    [
      search,
      status,
      companyId,
      branchId,
      departmentId,
      designationId,
      hiringManagerEmployeeId,
    ],
  );

  const { data = [], isLoading, error, refetch, isFetching } = useJobOpenings(filters);

  const summary = useMemo(() => {
    return {
      total: data.length,
      open: data.filter((item) => item.status === JOB_OPENING_STATUS.OPEN).length,
      draft: data.filter((item) => item.status === JOB_OPENING_STATUS.DRAFT).length,
      onHold: data.filter((item) => item.status === JOB_OPENING_STATUS.ON_HOLD).length,
    };
  }, [data]);

  return (
    <WorkspaceShell>
      <p className="text-sm text-muted-foreground">
        Create openings with headcount, hiring manager, and weighted evaluation criteria.
        Publish when the checklist passes.
      </p>

      <KpiGrid columns={4}>
        <KpiCard
          title="Total openings"
          value={isLoading ? "—" : summary.total}
          icon={Briefcase}
          density="compact"
        />
        <KpiCard
          title="Open"
          value={isLoading ? "—" : summary.open}
          icon={CirclePlus}
          tone="success"
          density="compact"
        />
        <KpiCard
          title="Draft"
          value={isLoading ? "—" : summary.draft}
          icon={Briefcase}
          tone="neutral"
          density="compact"
        />
        <KpiCard
          title="On hold"
          value={isLoading ? "—" : summary.onHold}
          icon={CirclePause}
          tone="warning"
          density="compact"
        />
      </KpiGrid>

      <PageToolbar>
        <div className="flex w-full flex-col gap-3">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <Input
              placeholder="Search code, title, organization…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Select value={status} onValueChange={setStatus}>
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
              value={companyId}
              onChange={(value) => {
                setCompanyId(value);
                setBranchId("");
                setDepartmentId("");
                setDesignationId("");
                setHiringManagerEmployeeId("");
              }}
              items={companiesQuery.data ?? []}
              loading={companiesQuery.isLoading}
              placeholder="Company"
            />
            <LookupSelect
              value={branchId}
              onChange={(value) => {
                setBranchId(value);
                setDepartmentId("");
              }}
              items={branchesQuery.data ?? []}
              loading={branchesQuery.isLoading}
              placeholder="Branch"
              disabled={!companyId}
            />
          </div>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <LookupSelect
              value={departmentId}
              onChange={setDepartmentId}
              items={departmentsQuery.data ?? []}
              loading={departmentsQuery.isLoading}
              placeholder="Department"
              disabled={!branchId}
            />
            <LookupSelect
              value={designationId}
              onChange={setDesignationId}
              items={designationsQuery.data ?? []}
              loading={designationsQuery.isLoading}
              placeholder="Designation"
              disabled={!companyId}
            />
            <LookupSelect
              value={hiringManagerEmployeeId}
              onChange={setHiringManagerEmployeeId}
              items={managersQuery.data ?? []}
              loading={managersQuery.isLoading}
              placeholder="Hiring manager"
              disabled={!companyId}
            />
            <div className="flex justify-end gap-2 md:col-span-1 xl:col-span-1">
              <Button
                variant="outline"
                onClick={() => void refetch()}
                disabled={isFetching}
              >
                {isFetching ? "Refreshing…" : "Refresh"}
              </Button>
              {canManage ? (
                <Button
                  onClick={() =>
                    router.push(`${RECRUITMENT_ROUTES.openings.list}/new`)
                  }
                >
                  Create opening
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </PageToolbar>

      <JobOpeningTable
        data={data}
        isLoading={isLoading}
        error={
          error
            ? getApiErrorMessage(error, "We could not load job openings.")
            : null
        }
        onRetry={() => void refetch()}
        onRowClick={(opening) =>
          router.push(RECRUITMENT_ROUTES.openings.detail(opening.id))
        }
      />
    </WorkspaceShell>
  );
}
