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

interface TransferRow {
  id: string;
  version: number;
  status: string;
  allowedActions?: string[];
  asset?: { id: string; code?: string; name?: string; version?: number };
  fromDepartment?: { name?: string };
  toDepartment?: { name?: string };
}

function transferActions(row: TransferRow): string[] {
  return row.allowedActions ?? [];
}

export function AssetTransferWorkspace() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["assets", "transfers"],
    queryFn: () => AssetService.getTransfers({ limit: 50 }),
  });
  const items = (query.data?.items ?? []) as TransferRow[];
  const inbound = items.filter((row) =>
    transferActions(row).some((action) => action === "ACCEPT" || action === "REJECT"),
  );
  const outbound = items.filter((row) => transferActions(row).includes("CANCEL"));
  const [pending, setPending] = useState<{
    id: string;
    action: "reject" | "cancel" | "force";
    row: TransferRow;
  } | null>(null);

  const decide = useMutation({
    mutationFn: ({
      id,
      action,
      row,
      note,
    }: {
      id: string;
      action: "accept" | "reject" | "cancel" | "force";
      row: TransferRow;
      note?: string;
    }) =>
      AssetService.decideTransfer(id, action, {
        operationId: createOperationId(),
        expectedTransferVersion: row.version,
        expectedAssetVersion: row.asset?.version,
        decisionNote: action === "reject" ? note : undefined,
        reason: action === "cancel" ? note : undefined,
        forceReason: action === "force" ? note : undefined,
      }),
    onSuccess: () => {
      toast.success("Transfer updated.");
      setPending(null);
      void queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
    onError: (error) => {
      if (isAssetVersionConflict(error)) {
        void query.refetch();
      }
      toast.error(getAssetMutationMessage(error, "Unable to update transfer."));
    },
  });

  function renderRows(rows: TransferRow[]) {
    return rows.map((row) => {
      const actions = transferActions(row);
      return (
        <div
          key={row.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
        >
          <div>
            <p className="font-medium">
              {row.asset?.code} · {row.asset?.name}
            </p>
            <p className="text-muted-foreground text-sm">
              {row.fromDepartment?.name} → {row.toDepartment?.name} · {row.status}
            </p>
            {row.asset?.id ? (
              <p className="text-muted-foreground mt-1 text-xs">
                <Link
                  className="underline"
                  href={`/asset-management/assets?assetId=${row.asset.id}`}
                >
                  Open inventory
                </Link>
              </p>
            ) : null}
          </div>
          {actions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {actions.includes("ACCEPT") ? (
                <Button
                  size="sm"
                  disabled={decide.isPending}
                  onClick={() =>
                    decide.mutate({ id: row.id, action: "accept", row })
                  }
                >
                  Accept
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
                  variant="outline"
                  disabled={decide.isPending}
                  onClick={() =>
                    setPending({ id: row.id, action: "cancel", row })
                  }
                >
                  Cancel
                </Button>
              ) : null}
              {actions.includes("FORCE") ? (
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={decide.isPending}
                  onClick={() =>
                    setPending({ id: row.id, action: "force", row })
                  }
                >
                  Force
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      );
    });
  }

  return (
    <WorkspaceShell>
      <div className="rounded-xl border border-border bg-card p-4 text-sm">
        <p className="font-medium">What this page is</p>
        <p className="text-muted-foreground mt-1">
          Move hardware between <strong className="text-foreground">departments</strong>{" "}
          (e.g. Engineering → Sales). To give a laptop to Rohan, use{" "}
          <Link className="underline" href="/asset-management/assets">
            Assets → Assign
          </Link>
          . Licence seats are not transferred here.
        </p>
      </div>
      <p className="text-muted-foreground text-sm">
        Accept is one click. Reject / Cancel / Force need a reason.
      </p>
      {query.isLoading ? (
        <p className="text-muted-foreground text-sm">Loading transfers…</p>
      ) : (
        <div className="space-y-6">
          <section className="space-y-3">
            <h3 className="font-medium">Waiting for you (inbound)</h3>
            {inbound.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Nothing to accept. Empty is normal until someone starts a
                transfer from Assets.
              </p>
            ) : (
              renderRows(inbound)
            )}
          </section>
          <section className="space-y-3">
            <h3 className="font-medium">You started (outbound)</h3>
            {outbound.length === 0 ? (
              <p className="text-muted-foreground text-sm">No outbound transfers.</p>
            ) : (
              renderRows(outbound)
            )}
          </section>
        </div>
      )}

      <AssetCommandReasonDialog
        open={Boolean(pending)}
        onOpenChange={(open) => !open && setPending(null)}
        title={
          pending?.action === "reject"
            ? "Reject transfer"
            : pending?.action === "cancel"
              ? "Cancel transfer"
              : "Force transfer"
        }
        description={
          pending
            ? `${pending.row.asset?.code ?? "Asset"} · ${pending.row.fromDepartment?.name} → ${pending.row.toDepartment?.name}`
            : "Enter reason"
        }
        confirmLabel="Confirm"
        destructive={pending?.action !== "cancel"}
        loading={decide.isPending}
        onConfirm={(note) => {
          if (!pending) return;
          decide.mutate({ ...pending, note });
        }}
      />
    </WorkspaceShell>
  );
}
