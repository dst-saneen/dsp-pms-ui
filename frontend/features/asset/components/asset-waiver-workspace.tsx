"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import { getAssetMutationMessage, isAssetVersionConflict } from "../lib/asset-errors";
import { createOperationId } from "../lib/operation-id";
import { AssetService } from "../services/asset-service";
import { AssetCommandReasonDialog } from "./asset-command-reason-dialog";

interface WaiverRow {
  id: string;
  version?: number;
  status: string;
  reason?: string;
  reasonCode?: string;
  clearanceItemId?: string;
  clearanceItemVersion?: number;
  targetVersion?: number;
  assetId?: string;
  assetVersion?: number;
  allowedActions?: string[];
  clearanceItem?: {
    id: string;
    version?: number;
    employeeAsset?: {
      version?: number;
      assetId?: string;
      asset?: { version?: number; assetCode?: string; assetName?: string };
    };
    licenseAllocation?: {
      version?: number;
      assetId?: string;
      asset?: { version?: number; assetCode?: string; assetName?: string };
    };
    employee?: { name?: string; employeeCode?: string };
  };
}

function waiverActions(row: WaiverRow): string[] {
  return row.allowedActions ?? [];
}

function waiverLabel(row: WaiverRow) {
  const asset =
    row.clearanceItem?.employeeAsset?.asset ||
    row.clearanceItem?.licenseAllocation?.asset;
  const employee = row.clearanceItem?.employee;
  const parts = [
    employee?.employeeCode || employee?.name,
    asset?.assetCode || asset?.assetName,
    row.reason || row.reasonCode,
  ].filter(Boolean);
  return parts.join(" · ") || row.clearanceItemId || row.id;
}

export function AssetWaiverWorkspace() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["assets", "waivers"],
    queryFn: () => AssetService.getWaivers({ limit: 50 }),
  });
  const items = (query.data?.items ?? []) as WaiverRow[];
  const [pending, setPending] = useState<{
    id: string;
    action: "reject" | "cancel";
    row: WaiverRow;
  } | null>(null);

  const decide = useMutation({
    mutationFn: ({
      id,
      action,
      row,
      note,
    }: {
      id: string;
      action: "approve" | "reject" | "cancel";
      row: WaiverRow;
      note?: string;
    }) =>
      AssetService.decideWaiver(id, action, {
        operationId: createOperationId(),
        expectedWaiverVersion: row.version,
        expectedClearanceItemVersion:
          row.clearanceItemVersion ?? row.clearanceItem?.version,
        expectedTargetVersion:
          row.targetVersion ??
          row.clearanceItem?.employeeAsset?.version ??
          row.clearanceItem?.licenseAllocation?.version,
        expectedAssetVersion:
          row.assetVersion ??
          row.clearanceItem?.employeeAsset?.asset?.version ??
          row.clearanceItem?.licenseAllocation?.asset?.version,
        decisionNote: action === "reject" ? note : undefined,
        reason: action === "cancel" ? note : undefined,
      }),
    onSuccess: () => {
      toast.success("Waiver updated.");
      setPending(null);
      void queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
    onError: (error) => {
      if (isAssetVersionConflict(error)) {
        void query.refetch();
      }
      toast.error(getAssetMutationMessage(error, "Unable to update waiver."));
    },
  });

  return (
    <WorkspaceShell>
      <div className="rounded-xl border border-border bg-card p-4 text-sm">
        <p className="font-medium">What this page is</p>
        <p className="text-muted-foreground mt-1">
          Used only when an employee is leaving and a required asset cannot be
          returned (lost, stuck, etc.). Approving a waiver lets exit continue
          without that item. Day-to-day returns go through{" "}
          <Link className="underline" href="/asset-management/inbox">
            Custodian Inbox
          </Link>
          .
        </p>
      </div>
      {query.isLoading ? (
        <p className="text-muted-foreground text-sm">Loading waivers…</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No waivers yet — that is normal. They appear from employee separation
          / clearance when someone requests an exception.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((row) => {
            const actions = waiverActions(row);
            const assetId =
              row.assetId ??
              row.clearanceItem?.employeeAsset?.assetId ??
              row.clearanceItem?.licenseAllocation?.assetId;
            return (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
              >
                <div>
                  <p className="font-medium">{row.status}</p>
                  <p className="text-muted-foreground text-sm">{waiverLabel(row)}</p>
                  {assetId ? (
                    <p className="text-muted-foreground mt-1 text-xs">
                      <Link
                        className="underline"
                        href={`/asset-management/assets?assetId=${assetId}`}
                      >
                        Open asset
                      </Link>
                    </p>
                  ) : null}
                </div>
                {actions.length > 0 ? (
                  <div className="flex gap-2">
                    {actions.includes("APPROVE") ? (
                      <Button
                        size="sm"
                        disabled={decide.isPending}
                        onClick={() =>
                          decide.mutate({ id: row.id, action: "approve", row })
                        }
                      >
                        Approve
                      </Button>
                    ) : null}
                    {actions.includes("REJECT") ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={decide.isPending}
                        onClick={() =>
                          setPending({ id: row.id, action: "reject", row })
                        }
                      >
                        Reject
                      </Button>
                    ) : null}
                    {actions.includes("CANCEL") ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={decide.isPending}
                        onClick={() =>
                          setPending({ id: row.id, action: "cancel", row })
                        }
                      >
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <AssetCommandReasonDialog
        open={Boolean(pending)}
        onOpenChange={(open) => !open && setPending(null)}
        title={pending?.action === "reject" ? "Reject waiver" : "Cancel waiver"}
        description={pending ? waiverLabel(pending.row) : "Enter reason"}
        confirmLabel="Confirm"
        destructive
        loading={decide.isPending}
        onConfirm={(note) => {
          if (!pending) return;
          decide.mutate({ ...pending, note });
        }}
      />
    </WorkspaceShell>
  );
}
