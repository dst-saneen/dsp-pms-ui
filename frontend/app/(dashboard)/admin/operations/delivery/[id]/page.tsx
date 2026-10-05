"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";

import { PageContainer } from "@/components/common/page-container";
import { ModuleCapabilityGate } from "@/components/common/module-capability-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import {
  useDeliveryMessage,
  useDeliveryAttempts,
  useRetryDelivery,
  useCancelDelivery,
} from "@/features/delivery/hooks/use-delivery";
import { DeliveryStatusBadge } from "@/features/delivery/components/delivery-status-badge";
import { DeliveryAttemptTimeline } from "@/features/delivery/components/delivery-attempt-timeline";
import {
  DeliveryReasonDialog,
  type DeliveryReasonMode,
} from "@/features/delivery/components/delivery-reason-dialog";

export default function OpsDeliveryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [reasonMode, setReasonMode] = useState<DeliveryReasonMode | null>(null);

  const { data: message, isLoading: msgLoading } = useDeliveryMessage(id);
  const { data: attempts = [], isLoading: attLoading } = useDeliveryAttempts(id);
  const retry = useRetryDelivery();
  const cancel = useCancelDelivery();

  const canRetry = Boolean(message?.allowedActions?.includes("RETRY"));
  const canCancel = Boolean(message?.allowedActions?.includes("CANCEL"));

  return (
    <ModuleCapabilityGate capability="deliveryOperationsNav"><PageContainer>
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-1 size-4" />
          Back
        </Button>
        <h1 className="text-xl font-semibold">Delivery Detail (Ops)</h1>
      </div>

      {msgLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : message ? (
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="text-muted-foreground font-mono text-sm">
                  {message.outboxEventType}
                </span>
                <DeliveryStatusBadge status={message.status} />
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <Row label="Recipient" value={message.toDisplayName ?? message.recipientKind} />
              <Row label="Channel" value={message.channel} />
              <Row label="Provider" value={message.provider} />
              <Row label="Subject" value={message.subject ?? "—"} />
              <Row label="Attempts" value={String(message.attemptCount)} />
              {message.clientReference && (
                <Row label="Provider ref" value={message.clientReference} mono />
              )}
              {message.lastErrorCode && (
                <Row label="Last error" value={message.lastErrorCode} mono danger />
              )}
              {message.bypassReason && <Row label="Bypass reason" value={message.bypassReason} />}
              <Row
                label="Created"
                value={format(new Date(message.createdAt), "dd MMM yyyy, HH:mm")}
              />
              {message.deliveredAt && (
                <Row
                  label="Delivered"
                  value={format(new Date(message.deliveredAt), "dd MMM yyyy, HH:mm")}
                />
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            {canCancel && (
              <Button
                variant="outline"
                onClick={() => setReasonMode("cancel")}
                disabled={cancel.isPending || retry.isPending}
              >
                Cancel
              </Button>
            )}
            {canRetry && (
              <Button
                onClick={() => setReasonMode("retry")}
                disabled={retry.isPending || cancel.isPending}
              >
                Retry delivery
              </Button>
            )}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Delivery attempts</CardTitle>
            </CardHeader>
            <CardContent>
              {attLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : (
                <DeliveryAttemptTimeline attempts={attempts} />
              )}
            </CardContent>
          </Card>

          <DeliveryReasonDialog
            open={reasonMode !== null}
            onOpenChange={(open) => {
              if (!open) setReasonMode(null);
            }}
            mode={reasonMode ?? "retry"}
            loading={retry.isPending || cancel.isPending}
            onConfirm={async ({ reason }) => {
              const payload = {
                id: message.id,
                expectedVersion:
                  message.actionRequirements?.expectedVersion ?? message.version,
                reason,
              };
              if (reasonMode === "cancel") {
                await cancel.mutateAsync(payload);
              } else {
                await retry.mutateAsync(payload);
              }
              setReasonMode(null);
            }}
          />
        </div>
      ) : (
        <p className="text-muted-foreground py-8 text-center">Delivery message not found.</p>
      )}
    </PageContainer></ModuleCapabilityGate>
  );
}

function Row({
  label,
  value,
  mono,
  danger,
}: {
  label: string;
  value: string;
  mono?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span
        className={["text-right", mono ? "font-mono text-xs" : "", danger ? "text-destructive" : ""]
          .filter(Boolean)
          .join(" ")}
      >
        {value}
      </span>
    </div>
  );
}
