"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageToolbar } from "@/components/common/page-toolbar";
import { StatusBadge } from "@/components/common/status-badge";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/services/api-client";
import { useAuth } from "@/providers/auth-provider";
import { useAssetDepartments } from "../hooks/use-asset-inbox";
import { useDepartments } from "@/features/lookups/hooks/use-departments";
import { createOperationId } from "../lib/operation-id";
import { AssetService } from "../services/asset-service";
import { AssetCommandReasonDialog } from "./asset-command-reason-dialog";

interface GrantRow {
  id: string;
  version: number;
  active?: boolean;
  grantedAt?: string;
  user?: {
    id?: string;
    name?: string;
    displayName?: string;
    email?: string;
  };
  department?: { id?: string; name?: string };
  branch?: { id?: string; name?: string };
  company?: { id?: string; name?: string };
  grantedBy?: { id?: string; name?: string; displayName?: string };
  allowedActions?: string[];
}

function personLabel(row: GrantRow) {
  const user = row.user;
  return (
    user?.name?.trim() ||
    user?.displayName?.trim() ||
    user?.email?.trim() ||
    "Unknown person"
  );
}

function formatWhen(value?: string) {
  if (!value) return "—";
  const day = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}/.test(day)) return "—";
  return new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function AssetGrantWorkspace() {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canManageGrants = hasPermission("assets.department-access.manage");
  const { data: grantedDepartments = [] } = useAssetDepartments();
  const { data: allDepartments = [] } = useDepartments();
  const departments =
    grantedDepartments.length > 0
      ? grantedDepartments.map((department) => ({
          id: department.id,
          name: department.name,
        }))
      : allDepartments.map((department) => ({
          id: department.id,
          name: department.name,
        }));
  const [departmentId, setDepartmentId] = useState("");
  const [userId, setUserId] = useState("");
  const [grantReasonOpen, setGrantReasonOpen] = useState(false);
  const [pendingDecide, setPendingDecide] = useState<{
    id: string;
    action: "revoke" | "reactivate" | "regrant";
    version: number;
  } | null>(null);

  const usersQuery = useQuery({
    queryKey: ["assets", "department-grants", "eligible-users", departmentId],
    queryFn: () =>
      AssetService.getEligibleGrantUsers(
        departmentId ? { departmentId } : undefined,
      ),
    enabled: canManageGrants,
  });
  const eligibleUsers = usersQuery.data?.items ?? [];

  const query = useQuery({
    queryKey: ["assets", "department-grants"],
    queryFn: () => AssetService.getDepartmentGrants({ includeInactive: true }),
    enabled: canManageGrants,
  });
  const items = (query.data?.items ?? []) as GrantRow[];
  const activeCount = items.filter((row) => row.active !== false).length;

  const createGrant = useMutation({
    mutationFn: (reason: string) =>
      AssetService.createDepartmentGrant({
        operationId: createOperationId(),
        departmentId,
        userId,
        reason,
      }),
    onSuccess: () => {
      toast.success(
        "Custodian granted. Ask them to log out and in, then open Custodian Inbox.",
      );
      setUserId("");
      setGrantReasonOpen(false);
      void queryClient.invalidateQueries({
        queryKey: ["assets", "department-grants"],
      });
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Unable to create grant.")),
  });

  const decide = useMutation({
    mutationFn: ({
      id,
      action,
      version,
      reason,
    }: {
      id: string;
      action: "revoke" | "reactivate" | "regrant";
      version: number;
      reason: string;
    }) =>
      AssetService.decideDepartmentGrant(id, action, {
        operationId: createOperationId(),
        expectedVersion: version,
        reason,
      }),
    onSuccess: () => {
      toast.success("Grant updated.");
      setPendingDecide(null);
      void queryClient.invalidateQueries({
        queryKey: ["assets", "department-grants"],
      });
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Unable to update grant.")),
  });

  if (!canManageGrants) {
    return (
      <WorkspaceShell>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-medium">Owner or Company Admin only</p>
          <p className="mt-1">
            This page names department custodians. HR assigns items; Owner
            grants who can decide Inbox requests.
          </p>
        </div>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell>
      <div className="rounded-xl border border-border bg-card p-4 text-sm">
        <p className="font-medium">What a grant means</p>
        <p className="text-muted-foreground mt-1">
          You name who is the <strong className="text-foreground">asset keeper</strong>{" "}
          for a department (e.g. Meera for Engineering). They can open{" "}
          <Link className="underline" href="/asset-management/inbox">
            Custodian Inbox
          </Link>{" "}
          and approve/reject return, damaged, or lost requests for that
          department. It does <strong className="text-foreground">not</strong>{" "}
          give them the laptop — that is Assign.
        </p>
      </div>

      <PageToolbar>
        <span className="text-muted-foreground text-sm">
          {query.isLoading
            ? "Loading…"
            : `${activeCount} active grant${activeCount === 1 ? "" : "s"}`}
        </span>
        <Button
          variant="outline"
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
        >
          {query.isFetching ? "Refreshing…" : "Refresh"}
        </Button>
      </PageToolbar>

      <form
        className="grid gap-2 rounded-xl border p-4 sm:grid-cols-[1fr_1fr_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          if (!departmentId || !userId) return;
          setGrantReasonOpen(true);
        }}
      >
        <select
          className="h-9 rounded-lg border bg-card px-3 text-sm"
          value={departmentId}
          onChange={(event) => {
            setDepartmentId(event.target.value);
            setUserId("");
          }}
          aria-label="Department"
        >
          <option value="">Department</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-lg border bg-card px-3 text-sm"
          value={userId}
          onChange={(event) => setUserId(event.target.value)}
          disabled={usersQuery.isLoading || eligibleUsers.length === 0}
          aria-label="Person"
        >
          <option value="">
            {usersQuery.isLoading
              ? "Loading people…"
              : eligibleUsers.length === 0
                ? "No linked users in this company"
                : "Select person"}
          </option>
          {eligibleUsers.map((user) => (
            <option key={user.id} value={user.id}>
              {user.displayName}
              {user.employeeCode ? ` · ${user.employeeCode}` : ""}
              {user.email ? ` · ${user.email}` : ""}
            </option>
          ))}
        </select>
        <Button
          type="submit"
          disabled={createGrant.isPending || !departmentId || !userId}
        >
          Grant
        </Button>
      </form>

      {usersQuery.isError ? (
        <p className="text-destructive text-sm">
          {getApiErrorMessage(
            usersQuery.error,
            "Could not load people for grants.",
          )}
        </p>
      ) : null}

      {query.isLoading ? (
        <p className="text-muted-foreground text-sm">Loading grants…</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No custodians yet. Pick a department and person, then Grant.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs">
              <tr>
                <th className="px-4 py-3 font-medium">Who</th>
                <th className="px-4 py-3 font-medium">Department</th>
                <th className="px-4 py-3 font-medium">What they can do</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right"> </th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const active = row.active !== false;
                return (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <p className="font-medium">{personLabel(row)}</p>
                      {row.user?.email ? (
                        <p className="text-muted-foreground text-xs">
                          {row.user.email}
                        </p>
                      ) : null}
                      <p className="text-muted-foreground text-xs">
                        Granted {formatWhen(row.grantedAt)}
                        {row.grantedBy?.name || row.grantedBy?.displayName
                          ? ` · by ${row.grantedBy.name ?? row.grantedBy.displayName}`
                          : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">
                        {row.department?.name ?? "Department"}
                      </p>
                      {row.branch?.name ? (
                        <p className="text-muted-foreground text-xs">
                          {row.branch.name}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs sm:text-sm">
                      Decide return / damage / lost in Custodian Inbox for this
                      department
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        label={active ? "Active" : "Revoked"}
                        tone={active ? "success" : "neutral"}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {row.allowedActions?.includes("REVOKE") ? (
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={decide.isPending}
                            onClick={() =>
                              setPendingDecide({
                                id: row.id,
                                action: "revoke",
                                version: row.version,
                              })
                            }
                          >
                            Revoke
                          </Button>
                        ) : null}
                        {row.allowedActions?.includes("REACTIVATE") ? (
                          <Button
                            size="sm"
                            disabled={decide.isPending}
                            onClick={() =>
                              setPendingDecide({
                                id: row.id,
                                action: "reactivate",
                                version: row.version,
                              })
                            }
                          >
                            Reactivate
                          </Button>
                        ) : null}
                        {row.allowedActions?.includes("REGRANT") ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={decide.isPending}
                            onClick={() =>
                              setPendingDecide({
                                id: row.id,
                                action: "regrant",
                                version: row.version,
                              })
                            }
                          >
                            Regrant
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AssetCommandReasonDialog
        open={grantReasonOpen}
        onOpenChange={setGrantReasonOpen}
        title="Create department grant"
        description="Why is this person becoming custodian for the selected department?"
        confirmLabel="Create grant"
        loading={createGrant.isPending}
        onConfirm={(reason) => createGrant.mutate(reason)}
      />
      <AssetCommandReasonDialog
        open={Boolean(pendingDecide)}
        onOpenChange={(open) => !open && setPendingDecide(null)}
        title={
          pendingDecide?.action === "revoke"
            ? "Revoke grant"
            : pendingDecide?.action === "reactivate"
              ? "Reactivate grant"
              : "Regrant"
        }
        description="Enter the business reason for this grant change."
        confirmLabel="Confirm"
        destructive={pendingDecide?.action === "revoke"}
        loading={decide.isPending}
        onConfirm={(reason) => {
          if (!pendingDecide) return;
          decide.mutate({ ...pendingDecide, reason });
        }}
      />
    </WorkspaceShell>
  );
}
