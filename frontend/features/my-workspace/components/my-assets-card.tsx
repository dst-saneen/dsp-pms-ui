"use client";

import { useState } from "react";
import { Laptop } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/common/status-badge";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiErrorMessage } from "@/services/api-client";
import { hasAllowedAction } from "@/features/asset/lib/allowed-actions";
import { cn } from "@/lib/utils";

import { useMyAssetActions, useMyAssets } from "../hooks/use-my-workspace";
import type {
  MyLicenseAllocation,
  MyPendingAssetRequest,
  MyPhysicalAssignment,
} from "../types";

type RequestAction = {
  kind: "assignment" | "license";
  id: string;
  version: number;
  name: string;
  requestType: "RETURN" | "REPORT_DAMAGED" | "REPORT_LOST" | "REVOKE_LICENSE";
};

function pendingRequestLabel(request?: MyPendingAssetRequest | null) {
  if (!request) return null;
  switch (request.requestType) {
    case "RETURN":
      return "Return requested";
    case "REPORT_DAMAGED":
      return "Damage reported";
    case "REPORT_LOST":
      return "Lost reported";
    case "REVOKE_LICENSE":
      return "Revoke requested";
    default:
      return "Request pending";
  }
}

function pendingHint(request?: MyPendingAssetRequest | null) {
  if (!request) return null;
  const waiting =
    request.status === "IN_REVIEW" ? "In review" : "Waiting on custodian";
  return waiting;
}

export function MyAssetsCard({ embedded = false }: { embedded?: boolean } = {}) {
  const assetsQuery = useMyAssets();
  const actions = useMyAssetActions();
  const [requestAction, setRequestAction] = useState<RequestAction | null>(null);
  const [note, setNote] = useState("");

  const data = assetsQuery.data;
  const physical = data?.physicalAssignments ?? [];
  const licenses = data?.licenseAllocations ?? [];
  const busy =
    actions.createRequest.isPending ||
    actions.acknowledgeAssignment.isPending ||
    actions.acknowledgeAllocation.isPending;

  const submitRequest = async () => {
    if (!requestAction) {
      return;
    }
    const needsNote =
      requestAction.requestType === "REPORT_DAMAGED" ||
      requestAction.requestType === "REPORT_LOST";
    if (needsNote && !note.trim()) {
      toast.error("A note is required.");
      return;
    }

    try {
      await actions.createRequest.mutateAsync({
        targetType:
          requestAction.kind === "license"
            ? "LICENSE_ALLOCATION"
            : "EMPLOYEE_ASSET",
        targetId: requestAction.id,
        requestType: requestAction.requestType,
        expectedTargetVersion: requestAction.version,
        occurredOn: needsNote
          ? new Date().toISOString().slice(0, 10)
          : undefined,
        employeeNote: needsNote ? note.trim() : undefined,
      });
      setRequestAction(null);
      setNote("");
      toast.success("Request sent. Waiting for your department custodian.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not submit the request."));
    }
  };

  const acknowledgeAssignment = async (item: MyPhysicalAssignment) => {
    try {
      await actions.acknowledgeAssignment.mutateAsync({
        id: item.id,
        version: item.version,
      });
      toast.success("Assignment acknowledged.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not acknowledge."));
    }
  };

  const acknowledgeAllocation = async (item: MyLicenseAllocation) => {
    try {
      await actions.acknowledgeAllocation.mutateAsync({
        id: item.id,
        version: item.version,
      });
      toast.success("Licence acknowledged.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not acknowledge."));
    }
  };

  return (
    <>
      <Card
        className={cn(
          embedded &&
            "gap-0 overflow-visible border-0 bg-transparent py-0 shadow-none [--card-spacing:--spacing(0)]"
        )}
      >
        {!embedded ? (
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Laptop className="size-4" aria-hidden="true" />
              My assets & licences
            </CardTitle>
          </CardHeader>
        ) : null}
        <CardContent className={cn("space-y-4", embedded && "px-0")}>
          {assetsQuery.isLoading ? (
            <div className="space-y-3" aria-label="Loading assets and licences">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : assetsQuery.isError ? (
            <div className="border-destructive/15 bg-danger-soft/40 flex items-center justify-between gap-3 rounded-md border px-3 py-3">
              <div className="min-w-0">
                <p className="text-destructive text-sm font-medium">Could not load your items</p>
                <p className="text-muted-foreground mt-0.5 text-xs">Try refreshing this record.</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => void assetsQuery.refetch()}>
                Retry
              </Button>
            </div>
          ) : physical.length === 0 && licenses.length === 0 ? (
            <div className="bg-muted/30 flex items-center gap-3 rounded-md px-3 py-3">
              <span className="bg-cyan-50 text-cyan-600 dark:bg-cyan-950/30 dark:text-cyan-400 flex size-9 shrink-0 items-center justify-center rounded-md">
                <Laptop className="size-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-medium">No assigned assets</p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Hardware, cards, and licence seats will appear here.
                </p>
              </div>
            </div>
          ) : (
            <>
              {physical.map((item) => {
                const pendingLabel = pendingRequestLabel(item.pendingRequest);
                const pendingStatus = pendingHint(item.pendingRequest);
                return (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0"
                  >
                    <div>
                      <p className="font-medium">
                        {item.asset?.assetName ?? "Asset"}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {item.asset?.assetCode} · {item.asset?.kind ?? "HARDWARE"}
                      </p>
                      {pendingStatus ? (
                        <p className="text-muted-foreground mt-1 text-xs">
                          {pendingStatus}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge
                        label={pendingLabel ?? item.custodyStatus}
                        tone={pendingLabel ? "warning" : "neutral"}
                      />
                      {hasAllowedAction(item.allowedActions, "ACKNOWLEDGE") ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => {
                            void acknowledgeAssignment(item);
                          }}
                        >
                          Acknowledge
                        </Button>
                      ) : null}
                      {hasAllowedAction(item.allowedActions, "REQUEST_RETURN") ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() =>
                            setRequestAction({
                              kind: "assignment",
                              id: item.id,
                              version: item.version,
                              name: item.asset?.assetName ?? "Asset",
                              requestType: "RETURN",
                            })
                          }
                        >
                          Request return
                        </Button>
                      ) : null}
                      {hasAllowedAction(item.allowedActions, "REPORT_DAMAGED") ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() =>
                            setRequestAction({
                              kind: "assignment",
                              id: item.id,
                              version: item.version,
                              name: item.asset?.assetName ?? "Asset",
                              requestType: "REPORT_DAMAGED",
                            })
                          }
                        >
                          Damaged
                        </Button>
                      ) : null}
                      {hasAllowedAction(item.allowedActions, "REPORT_LOST") ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() =>
                            setRequestAction({
                              kind: "assignment",
                              id: item.id,
                              version: item.version,
                              name: item.asset?.assetName ?? "Asset",
                              requestType: "REPORT_LOST",
                            })
                          }
                        >
                          Lost
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}

              {licenses.map((item) => {
                const pendingLabel = pendingRequestLabel(item.pendingRequest);
                const pendingStatus = pendingHint(item.pendingRequest);
                return (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0"
                  >
                    <div>
                      <p className="font-medium">
                        {item.pool?.assetName ?? "Licence"}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {item.pool?.assetCode} · Licence seat
                      </p>
                      {pendingStatus ? (
                        <p className="text-muted-foreground mt-1 text-xs">
                          {pendingStatus}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge
                        label={pendingLabel ?? item.status}
                        tone={pendingLabel ? "warning" : "information"}
                      />
                      {hasAllowedAction(item.allowedActions, "ACKNOWLEDGE") ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => {
                            void acknowledgeAllocation(item);
                          }}
                        >
                          Acknowledge
                        </Button>
                      ) : null}
                      {hasAllowedAction(
                        item.allowedActions,
                        "REQUEST_LICENSE_REVOKE",
                      ) ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() =>
                            setRequestAction({
                              kind: "license",
                              id: item.id,
                              version: item.version,
                              name: item.pool?.assetName ?? "Licence",
                              requestType: "REVOKE_LICENSE",
                            })
                          }
                        >
                          Request revoke
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </CardContent>
      </Card>

      <ConfirmActionDialog
        open={!!requestAction}
        onOpenChange={(open) => {
          if (!open) {
            setRequestAction(null);
            setNote("");
          }
        }}
        title="Submit request"
        message="This notifies your department custodian. The item stays with you until they approve."
        name={requestAction?.name ?? "Item"}
        code={requestAction?.requestType}
        loading={actions.createRequest.isPending}
        confirmLabel="Submit"
        loadingLabel="Submitting..."
        onConfirm={() => {
          void submitRequest();
        }}
      >
        {requestAction?.requestType === "REPORT_DAMAGED" ||
        requestAction?.requestType === "REPORT_LOST" ? (
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Describe what happened"
            rows={3}
          />
        ) : null}
      </ConfirmActionDialog>
    </>
  );
}
