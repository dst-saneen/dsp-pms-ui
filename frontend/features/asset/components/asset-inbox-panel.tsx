"use client";

import { useState } from "react";
import { AlertTriangle, Inbox } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/common/status-badge";
import { hasAllowedAction } from "../lib/allowed-actions";
import { isSoftwareLicenseKind } from "../lib/kind-tracking";

import {
  useCompleteCustodyRequest,
  useRejectCustodyRequest,
} from "../hooks/use-custody-request-actions";
import { useAssetCustodyInbox, useExpiringAssets } from "../hooks/use-asset-inbox";
import type { CustodyRequest } from "../types/asset";
import { AssetCommandReasonDialog } from "./asset-command-reason-dialog";

interface AssetInboxPanelProps {
  alwaysShow?: boolean;
}

function requestLabel(request: CustodyRequest) {
  switch (request.requestType) {
    case "RETURN":
      return "Return item";
    case "REPORT_DAMAGED":
      return "Report damaged";
    case "REPORT_LOST":
      return "Report lost";
    case "REVOKE_LICENSE":
      return "Revoke licence seat";
    default:
      return request.requestType.replaceAll("_", " ").toLowerCase();
  }
}

function CustodyRequestRow({ request }: { request: CustodyRequest }) {
  const completeRequest = useCompleteCustodyRequest();
  const rejectRequest = useRejectCustodyRequest();
  const [decide, setDecide] = useState<"approve" | "reject" | null>(null);
  const busy = completeRequest.isPending || rejectRequest.isPending;
  const canComplete = hasAllowedAction(request.allowedActions, "COMPLETE");
  const canReject = hasAllowedAction(request.allowedActions, "REJECT");

  return (
    <>
      <div className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
        <div className="min-w-0">
          <p className="font-medium">
            {request.employee?.name ?? "Employee"} · {requestLabel(request)}
          </p>
          <p className="text-xs text-muted-foreground">
            {request.asset?.assetCode ?? request.targetType} ·{" "}
            {request.requestedAt.slice(0, 10)}
          </p>
          {request.asset?.assetName ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {request.asset.assetName}
            </p>
          ) : null}
          <p className="mt-1 text-xs text-muted-foreground">
            Only decide if you are the custodian for this department. Approve and
            reject both need a real note.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <StatusBadge label={request.status} tone="warning" />
          {canComplete || canReject ? (
            <div className="flex gap-2">
              {canReject ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setDecide("reject")}
                >
                  Reject
                </Button>
              ) : null}
              {canComplete ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  onClick={() => setDecide("approve")}
                >
                  Approve
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <AssetCommandReasonDialog
        open={decide === "approve"}
        onOpenChange={(open) => !open && setDecide(null)}
        title="Approve custody request"
        description={`${request.employee?.name ?? "Employee"} · ${requestLabel(request)}. Write why you are approving.`}
        confirmLabel="Approve"
        loading={completeRequest.isPending}
        onConfirm={(reason) => {
          completeRequest.mutate(
            { request, resolutionNote: reason },
            { onSuccess: () => setDecide(null) },
          );
        }}
      />
      <AssetCommandReasonDialog
        open={decide === "reject"}
        onOpenChange={(open) => !open && setDecide(null)}
        title="Reject custody request"
        description={`${request.employee?.name ?? "Employee"} · ${requestLabel(request)}. Write why you are rejecting.`}
        confirmLabel="Reject"
        destructive
        loading={rejectRequest.isPending}
        onConfirm={(reason) => {
          rejectRequest.mutate(
            { request, resolutionNote: reason },
            { onSuccess: () => setDecide(null) },
          );
        }}
      />
    </>
  );
}

export function AssetInboxPanel({ alwaysShow = false }: AssetInboxPanelProps) {
  const requestsQuery = useAssetCustodyInbox();
  const expiringQuery = useExpiringAssets();
  const requests = requestsQuery.data?.items ?? [];
  const expiring = expiringQuery.data?.items ?? [];

  if (!alwaysShow && requests.length === 0 && expiring.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Inbox className="size-4" />
            Pending requests
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No submitted requests for departments you custodian.
            </p>
          ) : (
            requests.map((request) => (
              <CustodyRequestRow key={request.id} request={request} />
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="size-4" />
            Expiring warranties and licences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {expiring.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing expiring in the next 30 days.
            </p>
          ) : (
            expiring.map((asset) => (
              <div
                key={asset.id}
                className="flex items-center justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0"
              >
                <div>
                  <p className="font-medium">{asset.assetName}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {asset.assetCode}
                  </p>
                </div>
                <StatusBadge
                  label={
                    isSoftwareLicenseKind(asset.kind)
                      ? `Licence ${asset.warrantyExpiry?.toString().slice(0, 10) ?? "soon"}`
                      : `Warranty ${asset.warrantyExpiry?.toString().slice(0, 10) ?? "soon"}`
                  }
                  tone="warning"
                />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
