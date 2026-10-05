"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";

import { PageContainer } from "@/components/common/page-container";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import {
  useDeliveryMessage,
  useDeliveryAttempts,
  useRetryDelivery,
} from "@/features/delivery/hooks/use-delivery";
import { DeliveryStatusBadge } from "@/features/delivery/components/delivery-status-badge";
import { DeliveryAttemptTimeline } from "@/features/delivery/components/delivery-attempt-timeline";
import { DeliveryReasonDialog } from "@/features/delivery/components/delivery-reason-dialog";

export default function HrDeliveryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [retryOpen, setRetryOpen] = useState(false);

  const { data: message, isLoading: msgLoading } = useDeliveryMessage(id);
  const { data: attempts = [], isLoading: attLoading } = useDeliveryAttempts(id);
  const retry = useRetryDelivery();

  const canRetry = Boolean(message?.allowedActions?.includes("RETRY"));

  return (
    <PageContainer>
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-1 size-4" />
          Back
        </Button>
        <h1 className="text-xl font-semibold">Delivery Detail</h1>
      </div>

      {msgLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : message ? (
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="font-mono text-sm text-muted-foreground">
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
                <Row
                  label="Provider ref"
                  value={message.clientReference}
                  mono
                />
              )}
              {message.lastErrorCode && (
                <Row
                  label="Last error"
                  value={message.lastErrorCode}
                  mono
                  danger
                />
              )}
              {message.bypassReason && (
                <Row label="Bypass reason" value={message.bypassReason} />
              )}
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

          {canRetry && (
            <div className="flex justify-end">
              <Button onClick={() => setRetryOpen(true)} disabled={retry.isPending}>
                {retry.isPending ? "Retrying…" : "Retry delivery"}
              </Button>
            </div>
          )}

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
            open={retryOpen}
            onOpenChange={setRetryOpen}
            mode="retry"
            loading={retry.isPending}
            onConfirm={async ({ reason }) => {
              await retry.mutateAsync({
                id: message.id,
                expectedVersion:
                  message.actionRequirements?.expectedVersion ?? message.version,
                reason,
              });
              setRetryOpen(false);
            }}
          />
        </div>
      ) : (
        <p className="py-8 text-center text-muted-foreground">
          Delivery message not found.
        </p>
      )}
    </PageContainer>
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
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span
        className={[
          "text-right",
          mono ? "font-mono text-xs" : "",
          danger ? "text-destructive" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {value}
      </span>
    </div>
  );
}
