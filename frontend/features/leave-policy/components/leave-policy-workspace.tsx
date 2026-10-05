"use client";

import { useMemo, useState } from "react";
import { GitBranch, Layers3 } from "lucide-react";

import { KpiCard } from "@/components/common/kpi-card";
import { KpiGrid } from "@/components/common/kpi-grid";
import { PageToolbar } from "@/components/common/page-toolbar";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/providers/auth-provider";
import { getApiErrorMessage } from "@/services/api-client";

import {
  useLeavePolicies,
  useUpdateLeaveTypeCarryForward,
} from "../hooks/use-leave-policies";
import { buildLeaveTypePolicySummaries } from "../lib/leave-policy-leave-type-summary";
import type { LeaveTypePolicySummary } from "../lib/leave-policy-leave-type-summary";
import { LeavePolicyMatrixWorkspace } from "./leave-policy-matrix-workspace";
import { LeaveTypePolicySummaryTable } from "./leave-type-policy-summary-table";

export function LeavePolicyWorkspace() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("hr.leave.manage");
  const [view, setView] = useState<"matrix" | "list">("matrix");
  const [search, setSearch] = useState("");
  const [savingRowId, setSavingRowId] = useState<string | null>(null);
  const { data = [], refetch, isFetching, isLoading, error } = useLeavePolicies();
  const updateCarryForward = useUpdateLeaveTypeCarryForward();

  const leaveTypeSummaries = useMemo(
    () => buildLeaveTypePolicySummaries(data),
    [data],
  );

  const filteredSummaries = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return leaveTypeSummaries;
    return leaveTypeSummaries.filter(
      (item) =>
        item.leaveTypeName.toLowerCase().includes(keyword) ||
        item.leaveTypeCode.toLowerCase().includes(keyword) ||
        item.branchName.toLowerCase().includes(keyword) ||
        item.companyName.toLowerCase().includes(keyword),
    );
  }, [leaveTypeSummaries, search]);

  async function handleSaveCarryForward(
    row: LeaveTypePolicySummary,
    value: number,
  ) {
    setSavingRowId(row.id);
    try {
      await updateCarryForward.mutateAsync({
        policyIds: row.policyIds,
        carryForwardLimit: value,
      });
    } finally {
      setSavingRowId(null);
    }
  }

  return (
    <WorkspaceShell>
      <KpiGrid columns={2}>
        <KpiCard
          title="Leave types"
          value={isLoading ? "—" : leaveTypeSummaries.length}
          icon={Layers3}
          density="compact"
        />
        <KpiCard
          title="Branches covered"
          value={
            isLoading
              ? "—"
              : new Set(leaveTypeSummaries.map((item) => item.branchId)).size
          }
          icon={GitBranch}
          tone="information"
          density="compact"
        />
      </KpiGrid>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={view === "matrix" ? "default" : "outline"}
            onClick={() => setView("matrix")}
          >
            Days by job role
          </Button>
          <Button
            type="button"
            variant={view === "list" ? "default" : "outline"}
            onClick={() => setView("list")}
          >
            Rules by leave type
          </Button>
        </div>
        <p className="text-muted-foreground text-sm">
          {view === "matrix" ? (
            <>
              <strong className="text-foreground">Days by job role</strong> —
              pick a branch, then enter how many days each role (Staff, Manager,
              …) gets for each leave type this year.
            </>
          ) : (
            <>
              <strong className="text-foreground">Rules by leave type</strong> —
              for each leave type, set how many unused days can move to next
              year, and whether employees can request more days than they have
              left.
            </>
          )}
        </p>
      </div>

      {view === "matrix" ? <LeavePolicyMatrixWorkspace /> : null}

      {view === "list" ? (
        <>
          <div className="rounded-lg border bg-muted/30 p-4 text-sm">
            <p className="text-foreground font-medium">What these columns mean</p>
            <ul className="text-muted-foreground mt-2 list-disc space-y-1.5 pl-5 text-xs sm:text-sm">
              <li>
                <strong className="text-foreground">Days / year</strong> — set
                on <em>Days by job role</em> (not here).
              </li>
              <li>
                <strong className="text-foreground">Carry forward</strong> — HR
                clicks <em>Edit</em> to set how many unused days can move to next
                year (e.g. 5). Applies to everyone on that leave type at that
                branch. Leave Types only turns carry forward on/off; the number
                is set here.
              </li>
              <li>
                <strong className="text-foreground">Balance below zero</strong> —
                <em>Not allowed</em> means they cannot take leave with no days
                left. <em>Allowed</em> means they may overdraw if policy
                permits.
              </li>
            </ul>
          </div>
          <PageToolbar>
            <Input
              placeholder="Search leave types…"
              className="max-w-sm"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => void refetch()}
                disabled={isFetching}
              >
                {isFetching ? "Refreshing…" : "Refresh"}
              </Button>
            </div>
          </PageToolbar>

          <LeaveTypePolicySummaryTable
            data={filteredSummaries}
            isLoading={isLoading}
            error={
              error
                ? getApiErrorMessage(error, "Could not load leave policies.")
                : null
            }
            onRetry={() => void refetch()}
            canManage={canManage}
            savingRowId={savingRowId}
            onSaveCarryForward={(row, value) => {
              void handleSaveCarryForward(row, value);
            }}
          />
        </>
      ) : null}
    </WorkspaceShell>
  );
}
