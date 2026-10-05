"use client";

import { useMemo, useState } from "react";
import { ClipboardCheck, Inbox } from "lucide-react";

import { KpiCard } from "@/components/common/kpi-card";
import { KpiGrid } from "@/components/common/kpi-grid";
import { PageToolbar } from "@/components/common/page-toolbar";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import { DataTable } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/providers/auth-provider";
import { getApiErrorMessage } from "@/services/api-client";

import { ProcessLeaveRequestSheet } from "../dialogs/process-leave-request-sheet";
import {
  useLeaveRequests,
  usePendingLeaveApprovals,
} from "../hooks/use-leave-requests";
import type { LeaveApprovalQueue, LeaveRequest } from "../types/leave-request";
import { leaveRequestColumns } from "./leave-request-columns";

type ViewMode = LeaveApprovalQueue | "all";
type ProcessMode = "approve" | "reject" | "cancel";

const LEAVE_HR_ROLES = [
  "HR_MANAGER",
  "COMPANY_ADMINISTRATOR",
  "ORGANIZATION_OWNER",
] as const;

export function LeaveRequestWorkspace() {
  const { user, hasPermission } = useAuth();
  const roles = user?.authorization.roles ?? [];

  const canSeeHrReview =
    hasPermission("hr.leave.manage") &&
    LEAVE_HR_ROLES.some((role) => roles.includes(role));
  /**
   * Reporting managers only. If the user is HR (HR review queue), hide Manager
   * review even when they also have team-approve — avoids empty confusing tab.
   */
  const canSeeManagerReview =
    Boolean(user?.employeeId) &&
    !canSeeHrReview &&
    (hasPermission("hr.team.approve") ||
      hasPermission("hr.leave.approve") ||
      hasPermission("hr.team.read"));

  const availableViews = useMemo(() => {
    const tabs: Array<{ key: ViewMode; label: string }> = [];
    if (canSeeManagerReview) {
      tabs.push({ key: "manager", label: "Manager review" });
    }
    if (canSeeHrReview) {
      tabs.push({ key: "hr", label: "HR review" });
    }
    tabs.push(
      { key: "completed", label: "Completed by me" },
      { key: "all", label: "All requests" },
    );
    return tabs;
  }, [canSeeHrReview, canSeeManagerReview]);

  const defaultView = useMemo<ViewMode>(() => {
    if (canSeeManagerReview && !canSeeHrReview) return "manager";
    if (canSeeHrReview && !canSeeManagerReview) return "hr";
    if (canSeeManagerReview) return "manager";
    if (canSeeHrReview) return "hr";
    return "completed";
  }, [canSeeHrReview, canSeeManagerReview]);

  const [view, setView] = useState<ViewMode>(defaultView);
  const [status, setStatus] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<LeaveRequest | null>(null);
  const [mode, setMode] = useState<ProcessMode>("approve");
  const [sheetOpen, setSheetOpen] = useState(false);

  const activeView = availableViews.some((tab) => tab.key === view)
    ? view
    : defaultView;

  const pendingQuery = usePendingLeaveApprovals(
    activeView === "all" ? "actionable" : activeView,
  );
  const allQuery = useLeaveRequests(
    status === "ALL" ? undefined : { status },
  );

  const activeQuery = activeView === "all" ? allQuery : pendingQuery;

  const filtered = useMemo(() => {
    const rows = activeQuery.data ?? [];
    const keyword = search.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter((item) => {
      const name = [item.employee?.firstName, item.employee?.lastName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return (
        name.includes(keyword) ||
        item.employee?.employeeCode?.toLowerCase().includes(keyword) ||
        item.leaveType?.leaveName.toLowerCase().includes(keyword) ||
        item.status.toLowerCase().includes(keyword)
      );
    });
  }, [activeQuery.data, search]);

  const columns = leaveRequestColumns((request, nextMode) => {
    setSelected(request);
    setMode(nextMode);
    setSheetOpen(true);
  });

  return (
    <WorkspaceShell>
      <KpiGrid columns={2}>
        <KpiCard
          title="Waiting on you"
          value={
            pendingQuery.isLoading ? "—" : (pendingQuery.data?.length ?? 0)
          }
          icon={Inbox}
          tone="warning"
          density="compact"
        />
        <KpiCard
          title="In this view"
          value={activeQuery.isLoading ? "—" : filtered.length}
          icon={ClipboardCheck}
          density="compact"
        />
      </KpiGrid>

      <PageToolbar>
        <div className="flex flex-wrap items-center gap-2">
          {availableViews.map((tab) => (
            <Button
              key={tab.key}
              type="button"
              variant={activeView === tab.key ? "default" : "outline"}
              onClick={() => setView(tab.key)}
            >
              {tab.label}
            </Button>
          ))}
          {activeView === "all" ? (
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {[
                  "ALL",
                  "DRAFT",
                  "SUBMITTED",
                  "APPROVED",
                  "REJECTED",
                  "CANCELLED",
                ].map((value) => (
                  <SelectItem key={value} value={value}>
                    {value === "ALL" ? "All statuses" : value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Input
            placeholder="Search employee or leave type…"
            className="max-w-sm"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Button
          variant="outline"
          onClick={() => void activeQuery.refetch()}
          disabled={activeQuery.isFetching}
        >
          {activeQuery.isFetching ? "Refreshing…" : "Refresh"}
        </Button>
      </PageToolbar>

      <DataTable
        columns={columns}
        data={filtered}
        isLoading={activeQuery.isLoading}
        error={
          activeQuery.error
            ? getApiErrorMessage(
                activeQuery.error,
                "Could not load leave requests.",
              )
            : null
        }
        onRetry={() => void activeQuery.refetch()}
        emptyTitle={
          activeView === "all" ? "No leave requests" : "No items in this queue"
        }
        emptyDescription={
          activeView === "manager"
            ? "Leave from your team waiting for your approval appears here."
            : activeView === "hr"
              ? "Leave waiting for HR approval appears here (after the manager step)."
              : activeView === "completed"
                ? "Leave you have already approved or rejected appears here."
                : "Adjust filters or wait for employees to apply leave."
        }
        enablePagination
        pageSize={10}
      />

      <ProcessLeaveRequestSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        request={selected}
        mode={mode}
      />
    </WorkspaceShell>
  );
}
