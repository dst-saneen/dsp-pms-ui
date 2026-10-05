"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { PageToolbar } from "@/components/common/page-toolbar";
import { StatusBadge } from "@/components/common/status-badge";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  getAssetMutationMessage,
  isAssetVersionConflict,
} from "../lib/asset-errors";
import {
  normalizeLicenseAllocation,
  type LicenseAllocationApiRow,
} from "../lib/license-allocation-display";
import { useEligibleEmployees } from "../hooks/use-eligible-employees";
import { AssetDialog } from "../dialogs/asset-dialog";
import { createOperationId } from "../lib/operation-id";
import { AssetService } from "../services/asset-service";
import type { Asset } from "../types/asset";
import { AssetCommandReasonDialog } from "./asset-command-reason-dialog";

export function AssetLicenseWorkspace() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [assetId, setAssetId] = useState("");
  const [observedPoolItems, setObservedPoolItems] = useState<Asset[] | null>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [seatCapacityDraft, setSeatCapacityDraft] = useState<{
    assetId: string;
    capacity: number | null;
    value: string;
  } | null>(null);
  const [resizeOpen, setResizeOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ReturnType<
    typeof normalizeLicenseAllocation
  > | null>(null);

  const pools = useQuery({
    queryKey: ["assets", "license-pools"],
    queryFn: () =>
      AssetService.getAll({
        catalog: "LICENSE",
        kind: "SOFTWARE_LICENSE",
        trackingMode: "POOL",
        limit: 100,
        includeInactive: false,
      }),
  });
  const poolItems = useMemo(
    () => (pools.data?.items ?? []) as Asset[],
    [pools.data?.items],
  );

  if (poolItems !== observedPoolItems) {
    setObservedPoolItems(poolItems);
    if (!assetId && poolItems.length === 1) {
      setAssetId(poolItems[0].id);
    }
  }

  const selectedPool = useMemo(
    () => poolItems.find((item) => item.id === assetId),
    [assetId, poolItems],
  );
  const eligibleEmployees = useEligibleEmployees(assetId || undefined);
  const employeeItems = eligibleEmployees.data?.items ?? [];

  const allocations = useQuery({
    queryKey: ["assets", "license-allocations", assetId || "none"],
    enabled: Boolean(assetId),
    queryFn: () =>
      AssetService.getLicenseAllocationPage({
        assetId,
        limit: 100,
      }),
  });

  const allAllocations = useQuery({
    queryKey: ["assets", "license-allocations", "seat-counts"],
    queryFn: () =>
      AssetService.getLicenseAllocationPage({
        limit: 200,
      }),
    enabled: poolItems.length > 0,
  });

  const seatRows = useMemo(
    () =>
      ((allocations.data?.items ?? []) as LicenseAllocationApiRow[])
        .map(normalizeLicenseAllocation)
        .filter((row) => row.status.toUpperCase() !== "REVOKED"),
    [allocations.data?.items],
  );

  const usedByPool = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of (allAllocations.data?.items ??
      []) as LicenseAllocationApiRow[]) {
      const normalized = normalizeLicenseAllocation(row);
      if (normalized.status.toUpperCase() === "REVOKED") continue;
      if (!normalized.poolId) continue;
      map.set(normalized.poolId, (map.get(normalized.poolId) ?? 0) + 1);
    }
    return map;
  }, [allAllocations.data?.items]);

  const selectedActiveSeats = seatRows.length;
  const pendingAckSeats = seatRows.filter((row) => row.pendingAck).length;
  const capacity = selectedPool?.softwareLicenseDetail?.seatCapacity ?? null;
  if (
    seatCapacityDraft &&
    (seatCapacityDraft.assetId !== assetId ||
      seatCapacityDraft.capacity !== capacity)
  ) {
    setSeatCapacityDraft(null);
  }
  const seatCapacity =
    seatCapacityDraft?.assetId === assetId &&
    seatCapacityDraft.capacity === capacity
      ? seatCapacityDraft.value
      : typeof capacity === "number"
        ? String(capacity)
        : "";
  const remaining =
    typeof capacity === "number"
      ? Math.max(capacity - selectedActiveSeats, 0)
      : null;
  const poolFull = typeof capacity === "number" && remaining === 0;

  const allocate = useMutation({
    mutationFn: () =>
      AssetService.allocateLicense(assetId, {
        operationId: createOperationId(),
        employeeId,
        allocatedDate: new Date().toISOString().slice(0, 10),
        expectedPoolVersion: selectedPool?.version,
      }),
    onSuccess: () => {
      toast.success("Seat given.");
      setEmployeeId("");
      void queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
    onError: (error) => {
      if (isAssetVersionConflict(error)) {
        void pools.refetch();
        void allocations.refetch();
      }
      toast.error(getAssetMutationMessage(error, "Unable to give seat."));
    },
  });

  const resize = useMutation({
    mutationFn: (reason: string) =>
      AssetService.resizeLicensePool(assetId, {
        operationId: createOperationId(),
        expectedVersion: selectedPool?.version ?? 1,
        seatCapacity: Number(seatCapacity),
        reason,
      }),
    onSuccess: () => {
      toast.success("Seat total updated.");
      setSeatCapacityDraft(null);
      setResizeOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
    onError: (error) => {
      if (isAssetVersionConflict(error)) {
        void pools.refetch();
      }
      toast.error(getAssetMutationMessage(error, "Unable to resize pool."));
    },
  });

  const revoke = useMutation({
    mutationFn: ({
      row,
      reason,
    }: {
      row: NonNullable<typeof revokeTarget>;
      reason: string;
    }) =>
      AssetService.revokeLicense(row.id, {
        operationId: createOperationId(),
        expectedAllocationVersion: row.version,
        expectedPoolVersion: row.poolVersion ?? selectedPool?.version,
        revokedDate: new Date().toISOString().slice(0, 10),
        reason,
      }),
    onSuccess: () => {
      toast.success("Seat revoked.");
      setRevokeTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
    onError: (error) => {
      if (isAssetVersionConflict(error)) {
        void pools.refetch();
        void allocations.refetch();
      }
      toast.error(getAssetMutationMessage(error, "Unable to revoke seat."));
    },
  });

  return (
    <WorkspaceShell>
      <PageToolbar>
        <span className="text-muted-foreground text-sm">
          {pools.isLoading
            ? "Loading…"
            : `${poolItems.length} pool${poolItems.length === 1 ? "" : "s"}`}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              void pools.refetch();
              void allAllocations.refetch();
              void allocations.refetch();
            }}
            disabled={pools.isFetching}
          >
            {pools.isFetching ? "Refreshing…" : "Refresh"}
          </Button>
          <Button onClick={() => setCreateOpen(true)}>New pool</Button>
        </div>
      </PageToolbar>

      {pools.isLoading ? (
        <p className="text-muted-foreground text-sm">Loading pools…</p>
      ) : poolItems.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title="No licence pools"
          description="Create a pool (e.g. Adobe), then give seats to people."
          actionLabel="New pool"
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs">
              <tr>
                <th className="px-4 py-3 font-medium">Licence</th>
                <th className="px-4 py-3 font-medium">Used</th>
                <th className="px-4 py-3 font-medium">Remaining</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right"> </th>
              </tr>
            </thead>
            <tbody>
              {poolItems.map((pool) => {
                const usedFromAll = usedByPool.get(pool.id) ?? 0;
                const used =
                  pool.id === assetId
                    ? Math.max(selectedActiveSeats, usedFromAll)
                    : usedFromAll;
                const cap = pool.softwareLicenseDetail?.seatCapacity;
                const free =
                  typeof cap === "number" ? Math.max(cap - used, 0) : null;
                const selected = pool.id === assetId;
                return (
                  <tr
                    key={pool.id}
                    className={
                      selected
                        ? "bg-primary/5 border-t border-border"
                        : "border-t border-border"
                    }
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium">{pool.assetName}</p>
                      <p className="text-muted-foreground font-mono text-xs">
                        {pool.assetCode}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium">{used}</span>
                      {typeof cap === "number" ? (
                        <span className="text-muted-foreground">
                          {" "}
                          / {cap}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      {free != null ? (
                        <span className="font-medium">{free}</span>
                      ) : (
                        <span className="text-muted-foreground">Set total</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        label={pool.lifecycleStatus ?? "ACTIVE"}
                        tone="success"
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant={selected ? "default" : "outline"}
                        onClick={() => {
                          setAssetId(pool.id);
                          setEmployeeId("");
                          if (pool.id !== assetId) {
                            setSeatCapacityDraft(null);
                          }
                        }}
                      >
                        {selected ? "Open" : "View people"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedPool ? (
        <div className="space-y-4 rounded-xl border border-border p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold">{selectedPool.assetName}</h3>
              <p className="text-muted-foreground text-xs">
                Seat counts for this licence pool
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/asset-management/employee-assets">
                See all assignments
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border bg-muted/20 px-3 py-2">
              <p className="text-muted-foreground text-xs">Total</p>
              <p className="text-lg font-semibold">
                {typeof capacity === "number" ? capacity : "—"}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/20 px-3 py-2">
              <p className="text-muted-foreground text-xs">Used</p>
              <p className="text-lg font-semibold">{selectedActiveSeats}</p>
            </div>
            <div className="rounded-lg border bg-muted/20 px-3 py-2">
              <p className="text-muted-foreground text-xs">Remaining</p>
              <p className="text-lg font-semibold">
                {remaining != null ? remaining : "—"}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/20 px-3 py-2">
              <p className="text-muted-foreground text-xs">Pending ack</p>
              <p className="text-lg font-semibold">{pendingAckSeats}</p>
            </div>
          </div>
          {typeof capacity !== "number" ? (
            <p className="text-amber-800 text-xs">
              Total seats not set yet. Enter a number below and click Update
              total so Remaining can show.
            </p>
          ) : null}

          <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-2">
              <Label htmlFor="license-employee">Give seat to</Label>
              <select
                id="license-employee"
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                value={employeeId}
                onChange={(event) => setEmployeeId(event.target.value)}
                disabled={eligibleEmployees.isLoading || poolFull}
              >
                <option value="">
                  {poolFull ? "No free seats" : "Select employee"}
                </option>
                {employeeItems.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.code} · {employee.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button
                className="w-full sm:w-auto"
                disabled={
                  allocate.isPending || !assetId || !employeeId || poolFull
                }
                onClick={() => allocate.mutate()}
              >
                {allocate.isPending ? "Saving…" : "Give seat"}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="seat-capacity">Total seats</Label>
              <Input
                id="seat-capacity"
                className="w-36"
                value={seatCapacity}
                onChange={(event) =>
                  setSeatCapacityDraft({
                    assetId,
                    capacity,
                    value: event.target.value,
                  })
                }
                placeholder="e.g. 10"
              />
            </div>
            <Button
              variant="outline"
              disabled={
                resize.isPending ||
                !seatCapacity ||
                (typeof capacity === "number" &&
                  Number(seatCapacity) === capacity)
              }
              onClick={() => setResizeOpen(true)}
            >
              Update total
            </Button>
          </div>

          {allocations.isLoading ? (
            <p className="text-muted-foreground text-sm">Loading people…</p>
          ) : seatRows.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nobody has this licence yet.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/40 text-muted-foreground text-xs">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Who</th>
                    <th className="px-4 py-2.5 font-medium">Given on</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium text-right"> </th>
                  </tr>
                </thead>
                <tbody>
                  {seatRows.map((row) => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="px-4 py-2.5 font-medium">
                        {row.employeeLabel}
                        {row.pendingAck ? (
                          <span className="text-muted-foreground ml-2 text-xs font-normal">
                            · awaiting ack
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2.5">{row.givenOn ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        <StatusBadge
                          label={row.status}
                          tone={
                            row.status.toUpperCase() === "ACTIVE"
                              ? "success"
                              : "neutral"
                          }
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {row.allowedActions.includes("REVOKE") ? (
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={revoke.isPending}
                            onClick={() => setRevokeTarget(row)}
                          >
                            Revoke
                          </Button>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      <AssetDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        asset={null}
        catalog="LICENSE"
      />
      <AssetCommandReasonDialog
        open={resizeOpen}
        onOpenChange={setResizeOpen}
        title="Update total seats"
        description={`New total: ${seatCapacity || "—"}. Add a short reason.`}
        confirmLabel="Update"
        loading={resize.isPending}
        onConfirm={(reason) => resize.mutate(reason)}
      />
      <AssetCommandReasonDialog
        open={Boolean(revokeTarget)}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
        title="Revoke seat"
        description={
          revokeTarget
            ? `${revokeTarget.employeeLabel} · ${revokeTarget.licenceName}`
            : "Revoke this seat"
        }
        confirmLabel="Revoke"
        destructive
        loading={revoke.isPending}
        onConfirm={(reason) => {
          if (!revokeTarget) return;
          revoke.mutate({ row: revokeTarget, reason });
        }}
      />
    </WorkspaceShell>
  );
}
