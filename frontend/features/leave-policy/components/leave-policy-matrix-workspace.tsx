"use client";

import { useEffect, useMemo, useState } from "react";

import { toast } from "sonner";

import { LookupSelect } from "@/components/forms";
import { PageToolbar } from "@/components/common/page-toolbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useBranches } from "@/features/lookups/hooks/use-branches";
import { useCompanies } from "@/features/lookups/hooks/use-companies";
import { useDepartments } from "@/features/lookups/hooks/use-departments";
import { useAuth } from "@/providers/auth-provider";
import { getApiErrorMessage } from "@/services/api-client";
import { cn } from "@/lib/utils";

import {
  useLeavePolicyMatrix,
  useReplaceLeavePolicyMatrix,
} from "../hooks/use-leave-policies";
import {
  formatAnnualEntitlement,
  MAX_ANNUAL_ENTITLEMENT,
  parseAnnualEntitlement,
} from "../lib/leave-entitlement";
import type {
  LeavePolicyMatrixCell,
  LeavePolicyMatrixImpact,
} from "../types/leave-policy";

type DraftCell = {
  enabled: boolean;
  annualEntitlement: string;
};

function cellKey(designationId: string, leaveTypeId: string) {
  return `${designationId}:${leaveTypeId}`;
}

export function LeavePolicyMatrixWorkspace() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("hr.leave.manage");
  const [companyId, setCompanyId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState("");
  const [draft, setDraft] = useState<Record<string, DraftCell>>({});
  const [impact, setImpact] = useState<LeavePolicyMatrixImpact | null>(null);

  const companies = useCompanies();
  const branches = useBranches(companyId || undefined);
  const departments = useDepartments(branchId || undefined, {
    enabled: Boolean(branchId),
  });
  const matrixQuery = useLeavePolicyMatrix({
    branchId: branchId || undefined,
    departmentId: departmentId || undefined,
  });
  const saveMatrix = useReplaceLeavePolicyMatrix();

  const matrix = matrixQuery.data;
  const dirtyKeys = Object.keys(draft);
  const dirty = dirtyKeys.length > 0;
  const filterKey = `${companyId}:${branchId}:${departmentId}`;
  const [boundFilter, setBoundFilter] = useState(filterKey);
  const snapshotToken = matrixQuery.data?.snapshotToken ?? "";
  const [boundSnapshot, setBoundSnapshot] = useState(snapshotToken);

  if (boundFilter !== filterKey) {
    setBoundFilter(filterKey);
    setDraft({});
    setReason("");
    setImpact(null);
  }
  if (snapshotToken && boundSnapshot !== snapshotToken) {
    setBoundSnapshot(snapshotToken);
    setDraft({});
    setReason("");
  }

  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const cellMap = useMemo(() => {
    const map = new Map<string, LeavePolicyMatrixCell>();
    for (const cell of matrix?.cells ?? []) {
      map.set(cellKey(cell.designationId, cell.leaveTypeId), cell);
    }
    return map;
  }, [matrix?.cells]);

  const designations = (matrix?.designations ?? []).filter((row) => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return true;
    return (
      row.designationName.toLowerCase().includes(keyword) ||
      row.designationCode.toLowerCase().includes(keyword)
    );
  });

  function resolvedCell(designationId: string, leaveTypeId: string): DraftCell {
    const key = cellKey(designationId, leaveTypeId);
    if (draft[key]) return draft[key];
    const saved = cellMap.get(key);
    return {
      enabled: Boolean(saved?.enabled),
      annualEntitlement: formatAnnualEntitlement(saved?.annualEntitlement),
    };
  }

  function patchCell(
    designationId: string,
    leaveTypeId: string,
    patch: Partial<DraftCell>,
  ) {
    const key = cellKey(designationId, leaveTypeId);
    const current = resolvedCell(designationId, leaveTypeId);
    const next = { ...current, ...patch };
    const saved = cellMap.get(key);
    const savedEnabled = Boolean(saved?.enabled);
    const savedDays = formatAnnualEntitlement(saved?.annualEntitlement);
    if (
      next.enabled === savedEnabled &&
      next.annualEntitlement === savedDays
    ) {
      setDraft((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
      return;
    }
    setDraft((prev) => ({ ...prev, [key]: next }));
  }

  async function onSave() {
    if (!branchId || !matrix || !canManage) return;
    const cells = matrix.designations.flatMap((designation) =>
      matrix.leaveTypes.map((leaveType) => {
        const cell = resolvedCell(designation.id, leaveType.id);
        const annual = parseAnnualEntitlement(cell.annualEntitlement);
        return {
          designationId: designation.id,
          leaveTypeId: leaveType.id,
          enabled: cell.enabled,
          annualEntitlement: cell.enabled && annual != null ? annual : undefined,
          annual,
        };
      }),
    );
    if (
      cells.some(
        (cell) =>
          cell.enabled &&
          (cell.annual == null ||
            !Number.isFinite(cell.annual) ||
            cell.annual <= 0 ||
            !Number.isFinite(cell.annualEntitlement) ||
            (cell.annualEntitlement ?? 0) <= 0),
      )
    ) {
      toast.error(
        "Enabled cells need days per year greater than zero before saving.",
      );
      return;
    }
    try {
      const result = await saveMatrix.mutateAsync({
        branchId,
        departmentId: departmentId || undefined,
        snapshotToken: matrix.snapshotToken,
        reason: reason.trim(),
        cells: cells.map(({ designationId, leaveTypeId, enabled, annualEntitlement }) => ({
          designationId,
          leaveTypeId,
          enabled,
          annualEntitlement,
        })),
      });
      setDraft({});
      setImpact({ ...result.impact, saved: result.saved });
    } catch {
      // Toast is handled by the mutation.
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Each <strong className="text-foreground">row</strong> is a job role.
        Each <strong className="text-foreground">column</strong> is a leave
        type. Type how many days that role gets <strong className="text-foreground">per year</strong>{" "}
        (for example 12 or 18.5). Saving updates the rules only — employee
        balances change after you run{" "}
        <a className="underline" href="/hr/leave/balances">
          Generate balances
        </a>
        .
      </p>
      <PageToolbar>
        <div className="flex min-w-0 flex-1 flex-wrap gap-2">
          <div className="w-52">
            <LookupSelect
              value={companyId}
              onChange={(value) => {
                setCompanyId(value);
                setBranchId("");
                setDepartmentId("");
              }}
              items={companies.data ?? []}
              placeholder="Company"
              loading={companies.isLoading}
            />
          </div>
          <div className="w-52">
            <LookupSelect
              value={branchId}
              onChange={(value) => {
                setBranchId(value);
                setDepartmentId("");
              }}
              items={branches.data ?? []}
              placeholder="Branch"
              loading={branches.isLoading}
              disabled={!companyId}
            />
          </div>
          <div className="w-52">
            <LookupSelect
              value={departmentId}
              onChange={setDepartmentId}
              items={departments.data ?? []}
              placeholder="All departments"
              loading={departments.isLoading}
              disabled={!branchId}
              clearable
            />
          </div>
          <Input
            placeholder="Search designations…"
            className="max-w-xs"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </PageToolbar>

      {!branchId ? (
        <p className="text-muted-foreground text-sm">
          Select a branch to load the designation matrix.
        </p>
      ) : matrixQuery.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : matrixQuery.error ? (
        <div className="space-y-2">
          <p className="text-destructive text-sm">
            {getApiErrorMessage(
              matrixQuery.error,
              "Could not load the leave matrix.",
            )}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => void matrixQuery.refetch()}
          >
            Retry
          </Button>
        </div>
      ) : !matrix ||
        matrix.designations.length === 0 ||
        matrix.leaveTypes.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No designations or leave types are available in this office.
        </p>
      ) : (
        <div className="overflow-auto rounded-md border">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="bg-background sticky left-0 top-0 z-20 border-b px-3 py-2 text-left font-medium">
                  Designation
                </th>
                {matrix.leaveTypes.map((leaveType) => (
                  <th
                    key={leaveType.id}
                    className="bg-background sticky top-0 z-10 min-w-36 border-b px-3 py-2 text-left font-medium"
                  >
                    <span className="block">{leaveType.leaveName}</span>
                    <span className="text-muted-foreground text-xs">
                      {leaveType.leaveCode} · days / year
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {designations.length === 0 ? (
                <tr>
                  <td
                    className="text-muted-foreground px-3 py-4"
                    colSpan={matrix.leaveTypes.length + 1}
                  >
                    No designations match this search.
                  </td>
                </tr>
              ) : (
                designations.map((designation) => (
                  <tr key={designation.id}>
                    <th className="bg-background sticky left-0 z-10 border-b px-3 py-2 text-left font-normal">
                      {designation.designationName}
                      <span className="text-muted-foreground block text-xs">
                        {designation.designationCode}
                      </span>
                    </th>
                    {matrix.leaveTypes.map((leaveType) => {
                      const cell = resolvedCell(designation.id, leaveType.id);
                      const key = cellKey(designation.id, leaveType.id);
                      const isDirty = Boolean(draft[key]);
                      return (
                        <td
                          key={leaveType.id}
                          className={cn(
                            "border-b px-3 py-2 align-top",
                            isDirty && "bg-primary/5",
                          )}
                        >
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              className="size-4 rounded border-input"
                              checked={cell.enabled}
                              disabled={!canManage}
                              onChange={(event) =>
                                patchCell(designation.id, leaveType.id, {
                                  enabled: event.currentTarget.checked,
                                })
                              }
                            />
                            <span className="sr-only">
                              Enable {leaveType.leaveName} for{" "}
                              {designation.designationName}
                            </span>
                          </label>
                          <Input
                            type="number"
                            min={0.01}
                            max={MAX_ANNUAL_ENTITLEMENT}
                            step="0.01"
                            className="mt-1 h-8"
                            disabled={!canManage || !cell.enabled}
                            value={cell.annualEntitlement}
                            onChange={(event) =>
                              patchCell(designation.id, leaveType.id, {
                                annualEntitlement: event.target.value,
                              })
                            }
                            aria-label={`${designation.designationName} ${leaveType.leaveName} days per year`}
                            placeholder="0"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {dirty ? (
        <p className="text-sm font-medium">
          You have unsaved matrix changes. Saving will not update existing
          leave balances.
        </p>
      ) : null}

      {canManage && branchId ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-1">
            <label className="text-sm font-medium" htmlFor="matrix-reason">
              Save reason
            </label>
            <Textarea
              id="matrix-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why are these yearly entitlements changing?"
              rows={2}
            />
          </div>
          <Button
            type="button"
            disabled={
              !dirty ||
              reason.trim().length < 3 ||
              saveMatrix.isPending ||
              matrixQuery.isFetching
            }
            onClick={() => void onSave()}
          >
            {saveMatrix.isPending
              ? "Saving…"
              : `Save ${dirtyKeys.length || ""} changes`}
          </Button>
        </div>
      ) : null}

      {impact ? (
        <div className="rounded-md border p-3 text-sm">
          <p className="font-medium">
            Saved. Existing leave balances were not auto-updated.
          </p>
          {impact.saved ? (
            <p className="text-muted-foreground mt-1">
              {impact.saved.created} created, {impact.saved.updated} updated,{" "}
              {impact.saved.disabled} disabled, {impact.saved.unchanged}{" "}
              unchanged.
            </p>
          ) : null}
          <p className="text-muted-foreground mt-1">
            {impact.year}: {impact.missingBalanceCount} employee
            {impact.missingBalanceCount === 1 ? "" : "s"} still need balances
            created
            {impact.entitlementChangedCount
              ? `, ${impact.entitlementChangedCount} have a different yearly entitlement than before`
              : ""}
            .{" "}
            <a className="underline" href="/hr/leave/balances">
              Open Balances → Generate
            </a>{" "}
            (preview first). Existing balances stay until you generate.
          </p>
        </div>
      ) : null}
    </div>
  );
}
