"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";

import { KpiCard } from "@/components/common/kpi-card";
import { KpiGrid } from "@/components/common/kpi-grid";
import { PageToolbar } from "@/components/common/page-toolbar";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import { LookupSelect } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { RECRUITMENT_ROUTES } from "../../constants/routes";
import { INTERVIEW_SESSION_STATUS } from "../../types/enums";
import { useJobOpenings } from "../../openings/hooks/use-job-openings";
import { ScheduleInterviewDialog } from "../dialogs/schedule-interview-dialog";
import { useInterviewSessions } from "../hooks/use-interviews";
import type { InterviewSearch } from "../types/interview";
import { InterviewTable } from "./interview-table";

const STATUS_OPTIONS = [
  { value: "ALL", label: "All statuses" },
  { value: INTERVIEW_SESSION_STATUS.SCHEDULED, label: "Scheduled" },
  { value: INTERVIEW_SESSION_STATUS.RESCHEDULED, label: "Rescheduled" },
  { value: INTERVIEW_SESSION_STATUS.COMPLETED, label: "Completed" },
  { value: INTERVIEW_SESSION_STATUS.CANCELLED, label: "Cancelled" },
];

export function InterviewWorkspace() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(RECRUITMENT_PERMISSIONS.manage);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [jobOpeningId, setJobOpeningId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [scheduledFrom, setScheduledFrom] = useState("");
  const [scheduledTo, setScheduledTo] = useState("");
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const openingsQuery = useJobOpenings();
  const branchesQuery = useBranches();

  const openingItems =
    openingsQuery.data?.map((opening) => ({
      id: opening.id,
      code: opening.openingCode,
      name: opening.title,
    })) ?? [];

  const filters = useMemo<InterviewSearch>(
    () => ({
      search: search.trim() || undefined,
      status: status === "ALL" ? undefined : (status as InterviewSearch["status"]),
      jobOpeningId: jobOpeningId || undefined,
      branchId: branchId || undefined,
      scheduledFrom: scheduledFrom || undefined,
      scheduledTo: scheduledTo || undefined,
    }),
    [search, status, jobOpeningId, branchId, scheduledFrom, scheduledTo],
  );

  const { data = [], isLoading, error, refetch, isFetching } =
    useInterviewSessions(filters);

  const todayCount = data.filter((session) => {
    const day = new Date(session.scheduledStartAt).toDateString();
    return day === new Date().toDateString();
  }).length;

  return (
    <WorkspaceShell>
      <p className="text-sm text-muted-foreground">
        Schedule interview rounds from this calendar. Open a row to view details;
        Reschedule, Complete, Cancel, and Evaluate stay on the detail page.
      </p>

      <KpiGrid columns={3}>
        <KpiCard
          title="Scheduled interviews"
          value={isLoading ? "—" : data.length}
          icon={CalendarDays}
          density="compact"
        />
        <KpiCard
          title="Today"
          value={isLoading ? "—" : todayCount}
          icon={CalendarDays}
          tone="progress"
          density="compact"
        />
        <KpiCard
          title="Rescheduled"
          value={
            isLoading
              ? "—"
              : data.filter(
                  (item) => item.status === INTERVIEW_SESSION_STATUS.RESCHEDULED,
                ).length
          }
          icon={CalendarDays}
          tone="warning"
          density="compact"
        />
      </KpiGrid>

      <PageToolbar>
        <div className="flex w-full flex-col gap-3">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="interview-search" className="sr-only">
                Search interviews
              </Label>
              <Input
                id="interview-search"
                placeholder="Search candidate, opening, round…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="interview-status" className="sr-only">
                Interview status
              </Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="interview-status">
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
            </div>
            <div className="space-y-1">
              <Label htmlFor="interview-job-opening" className="sr-only">
                Job opening
              </Label>
              <LookupSelect
                id="interview-job-opening"
                value={jobOpeningId}
                onChange={setJobOpeningId}
                items={openingItems}
                loading={openingsQuery.isLoading}
                placeholder="Opening"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="interview-branch" className="sr-only">
                Branch
              </Label>
              <LookupSelect
                id="interview-branch"
                value={branchId}
                onChange={setBranchId}
                items={branchesQuery.data ?? []}
                loading={branchesQuery.isLoading}
                placeholder="Branch"
              />
            </div>
          </div>

          <div className="grid items-end gap-2 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1">
              <Label
                htmlFor="interview-scheduled-from"
                className="text-muted-foreground text-xs"
              >
                Scheduled from
              </Label>
              <Input
                id="interview-scheduled-from"
                type="date"
                value={scheduledFrom}
                onChange={(event) => setScheduledFrom(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label
                htmlFor="interview-scheduled-to"
                className="text-muted-foreground text-xs"
              >
                Scheduled to
              </Label>
              <Input
                id="interview-scheduled-to"
                type="date"
                value={scheduledTo}
                onChange={(event) => setScheduledTo(event.target.value)}
              />
            </div>
            <div className="flex gap-2 md:col-span-2 xl:col-span-2 xl:justify-end">
              <Button
                variant="outline"
                onClick={() => void refetch()}
                disabled={isFetching}
              >
                {isFetching ? "Refreshing…" : "Refresh"}
              </Button>
              {canManage ? (
                <Button onClick={() => setScheduleOpen(true)}>
                  Schedule interview
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </PageToolbar>

      <InterviewTable
        data={data}
        isLoading={isLoading}
        error={
          error
            ? getApiErrorMessage(error, "We could not load interviews.")
            : null
        }
        onRetry={() => void refetch()}
        onRowClick={(session) =>
          router.push(RECRUITMENT_ROUTES.interviews.detail(session.id))
        }
      />

      <ScheduleInterviewDialog open={scheduleOpen} onOpenChange={setScheduleOpen} />
    </WorkspaceShell>
  );
}
