"use client";

import { useState, type SyntheticEvent } from "react";
import {
  Archive,
  ArrowLeftRight,
  History,
  MoreHorizontal,
  Pencil,
  UserPlus,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useDepartments } from "@/features/lookups/hooks/use-departments";
import { getApiErrorMessage } from "@/services/api-client";
import { hasAllowedAction } from "../lib/allowed-actions";
import { createOperationId } from "../lib/operation-id";
import { useArchiveAsset } from "../hooks/use-archive-asset";
import { AssetService } from "../services/asset-service";
import type { Asset } from "../types/asset";

interface AssetActionsProps {
  asset: Asset;
  onEdit?: (asset: Asset) => void;
  onAssign?: (asset: Asset) => void;
}

export function AssetActions({ asset, onEdit, onAssign }: AssetActionsProps) {
  const archiveAsset = useArchiveAsset();
  const { data: departments = [] } = useDepartments(undefined, {
    companyId: asset.companyId,
  });
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [toDepartmentId, setToDepartmentId] = useState("");
  const [history, setHistory] = useState<
    Array<{
      id?: string;
      eventType?: string;
      occurredAt?: string;
      actor?: { name?: string };
      actionContext?: { reason?: string; note?: string };
      effectiveDate?: string;
    }>
  >([]);
  const canEdit = hasAllowedAction(asset.allowedActions, "UPDATE_METADATA");
  const canArchive = hasAllowedAction(asset.allowedActions, "ARCHIVE");
  const canAssign = hasAllowedAction(asset.allowedActions, "ASSIGN");
  const canTransfer = hasAllowedAction(asset.allowedActions, "TRANSFER");

  const stopRowClick = (event: Event | SyntheticEvent) => {
    event.stopPropagation();
  };

  if (!canEdit && !canArchive && !canAssign && !canTransfer) {
    return null;
  }

  return (
    <div
      className="flex justify-end"
      onClick={stopRowClick}
      onPointerDown={stopRowClick}
    >
      <DropdownMenu modal>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Actions for ${asset.assetName}`}
            onClick={stopRowClick}
            onKeyDown={stopRowClick}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={stopRowClick}>
          {canEdit && onEdit ? (
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                onEdit(asset);
              }}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
          ) : null}
          {canAssign && onAssign ? (
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                onAssign(asset);
              }}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Assign
            </DropdownMenuItem>
          ) : null}
          {canTransfer ? (
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                setTransferOpen(true);
              }}
            >
              <ArrowLeftRight className="mr-2 h-4 w-4" />
              Transfer
            </DropdownMenuItem>
          ) : null}
          {canEdit ? (
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                void AssetService.lifecycle(asset.id, "send-to-repair", {
                  operationId: createOperationId(),
                  expectedVersion: asset.version,
                  reason: "Send to repair",
                  effectiveDate: new Date().toISOString().slice(0, 10),
                }).then(
                  () => toast.success("Asset sent to repair."),
                  (error: unknown) =>
                    toast.error(
                      getApiErrorMessage(error, "Unable to update lifecycle."),
                    ),
                );
              }}
            >
              <Wrench className="mr-2 h-4 w-4" />
              Send to repair
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              void AssetService.getHistory(asset.id).then((payload) => {
                const events = Array.isArray(payload)
                  ? payload
                  : Array.isArray((payload as { items?: unknown[] })?.items)
                    ? ((payload as { items: unknown[] }).items ?? [])
                    : Array.isArray((payload as { events?: unknown[] })?.events)
                      ? ((payload as { events: unknown[] }).events ?? [])
                      : [];
                setHistory(
                  events as Array<{
                    id?: string;
                    eventType?: string;
                    occurredAt?: string;
                    actor?: { name?: string };
                    actionContext?: { reason?: string; note?: string };
                    effectiveDate?: string;
                  }>,
                );
                setHistoryOpen(true);
              });
            }}
          >
            <History className="mr-2 h-4 w-4" />
            History
          </DropdownMenuItem>
          {canArchive ? (
            <DropdownMenuItem
              className="text-red-600"
              onSelect={(event) => {
                event.preventDefault();
                setArchiveOpen(true);
              }}
            >
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmActionDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="Archive asset"
        message="Archiving hides this asset from active inventory. This is not a hard delete."
        name={asset.assetName}
        code={asset.assetCode}
        loading={archiveAsset.isPending}
        confirmLabel="Archive"
        loadingLabel="Archiving..."
        onConfirm={() => {
          if (!reason.trim()) {
            return;
          }
          archiveAsset.mutate(
            {
              id: asset.id,
              data: {
                operationId: createOperationId(),
                expectedVersion: asset.version,
                reason: reason.trim(),
              },
            },
            {
              onSuccess: () => {
                setArchiveOpen(false);
                setReason("");
              },
            },
          );
        }}
      >
        <Textarea
          aria-label="Reason for archiving this asset"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Reason for archive"
          rows={3}
        />
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        title="Transfer asset"
        message="Move this asset to another department in the same company."
        name={asset.assetName}
        code={asset.assetCode}
        confirmLabel="Request transfer"
        onConfirm={() => {
          if (!toDepartmentId || !reason.trim()) {
            return;
          }
          void AssetService.requestTransfer(asset.id, {
            operationId: createOperationId(),
            toDepartmentId,
            reason: reason.trim(),
            expectedAssetVersion: asset.version,
          }).then(
            () => {
              toast.success("Transfer requested.");
              setTransferOpen(false);
              setReason("");
            },
            (error: unknown) =>
              toast.error(getApiErrorMessage(error, "Unable to request transfer.")),
          );
        }}
      >
        <select
          aria-label="Destination department"
          className="mb-2 h-9 w-full rounded-lg border bg-card px-3 text-sm"
          value={toDepartmentId}
          onChange={(event) => setToDepartmentId(event.target.value)}
        >
          <option value="">Destination department</option>
          {departments
            .filter((department) => department.id !== asset.departmentId)
            .map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
        </select>
        <Textarea
          aria-label="Reason for transferring this asset"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Transfer reason"
          rows={3}
        />
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        title="Asset history"
        message="Recent lifecycle and custody events for this asset."
        name={asset.assetName}
        code={asset.assetCode}
        confirmLabel="Close"
        onConfirm={() => setHistoryOpen(false)}
      >
        {history.length === 0 ? (
          <p className="text-muted-foreground text-sm">No history events yet.</p>
        ) : (
          <div className="max-h-72 space-y-3 overflow-y-auto text-sm">
            {history.map((event, index) => (
              <div
                key={event.id ?? `${event.eventType}-${index}`}
                className="rounded-md border border-border p-2"
              >
                <p className="font-medium">
                  {(event.eventType ?? "EVENT").replaceAll("_", " ")}
                </p>
                <p className="text-muted-foreground text-xs">
                  {event.occurredAt
                    ? new Date(event.occurredAt).toLocaleString()
                    : "—"}
                  {event.actor?.name ? ` · ${event.actor.name}` : ""}
                  {event.effectiveDate ? ` · effective ${event.effectiveDate}` : ""}
                </p>
                {event.actionContext?.reason || event.actionContext?.note ? (
                  <p className="mt-1 text-xs">
                    {event.actionContext.reason || event.actionContext.note}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </ConfirmActionDialog>
    </div>
  );
}
