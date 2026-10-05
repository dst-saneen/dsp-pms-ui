"use client";

import Link from "next/link";
import { useState } from "react";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { ModuleCapabilityGate } from "@/components/common/module-capability-gate";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  useDeliveryMessages,
  useRetryDelivery,
  useCancelDelivery,
  useDeliveryHealth,
} from "@/features/delivery/hooks/use-delivery";
import { DeliveryMessageTable } from "@/features/delivery/components/delivery-message-table";
import { DeliveryStatusBadge } from "@/features/delivery/components/delivery-status-badge";
import { DeliveryReasonDialog } from "@/features/delivery/components/delivery-reason-dialog";
import { OpsPathBanner } from "@/features/delivery/components/ops-path-banner";
import type {
  DeliveryMessage,
  DeliveryMessageStatus,
} from "@/features/delivery/types/delivery";

const STATUS_OPTIONS: { value: "ALL" | DeliveryMessageStatus; label: string }[] = [
  { value: "ALL", label: "All statuses" },
  { value: "QUEUED", label: "Queued" },
  { value: "SENDING", label: "Sending" },
  { value: "RETRY_WAIT", label: "Retry wait" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "FAILED", label: "Failed" },
  { value: "DEAD_LETTER", label: "Dead letter" },
  { value: "BOUNCED_SOFT", label: "Soft bounce" },
  { value: "BOUNCED_HARD", label: "Hard bounce" },
  { value: "BYPASSED", label: "Bypassed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function OpsDeliveryPage() {
  const [status, setStatus] = useState<"ALL" | DeliveryMessageStatus>("ALL");
  const [reasonTarget, setReasonTarget] = useState<{
    message: DeliveryMessage;
    mode: "retry" | "cancel";
  } | null>(null);

  const { data, isLoading } = useDeliveryMessages({
    status: status === "ALL" ? undefined : status,
    limit: 50,
  });

  const { data: health } = useDeliveryHealth();
  const retry = useRetryDelivery();
  const cancel = useCancelDelivery();

  return (
    <ModuleCapabilityGate capability="deliveryOperationsNav"><PageContainer>
      <PageHeader
        title="Delivery Operations"
        description="Monitor and manage the delivery queue across all branches."
      />
      <OpsPathBanner
        current="queue"
        note="Retry failed/retryable items with a reason. Dead letters are exhausted failures. Suppressions block future sends to bounced/complained addresses."
      />

      {health ? (
        <div className="text-muted-foreground mb-4 rounded-lg border px-3 py-2 text-xs">
          Review queue status below and resolve recipient exceptions before
          retrying blocked deliveries. Open recipient exceptions:{" "}
          <strong className="text-foreground">
            {health.openRecipientExceptions}
          </strong>
        </div>
      ) : null}

      {/* Health summary */}
      {health?.queue && health.queue.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-3">
          {health.queue.map((item) => (
            <div
              key={`${item.status}-${item.channel}`}
              className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
            >
              <DeliveryStatusBadge status={item.status} />
              <span className="text-muted-foreground">{item.channel}</span>
              <span className="font-semibold tabular-nums">{item.count}</span>
            </div>
          ))}
        </div>
      )}

      <Tabs defaultValue="all">
        <div className="mb-4 flex items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="all">All messages</TabsTrigger>
            <TabsTrigger value="dead" asChild>
              <Link href="/admin/operations/delivery/dead-letters">
                Dead letters
              </Link>
            </TabsTrigger>
            <TabsTrigger value="suppress" asChild>
              <Link href="/admin/operations/delivery/suppressions">
                Suppressions
              </Link>
            </TabsTrigger>
          </TabsList>

          <Select value={status} onValueChange={(v) => setStatus(v as "ALL" | DeliveryMessageStatus)}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <TabsContent value="all">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <DeliveryMessageTable
              messages={data?.items ?? []}
              detailBasePath="/admin/operations/delivery"
              onRetry={(message) => setReasonTarget({ message, mode: "retry" })}
              onCancel={(message) => setReasonTarget({ message, mode: "cancel" })}
              isRetrying={retry.isPending}
              isCancelling={cancel.isPending}
              emptyHint="No delivery messages match this filter. Review recipient exceptions before retrying blocked deliveries."
            />
          )}
          {data && (
            <p className="mt-3 text-right text-xs text-muted-foreground">
              {data.total} total message{data.total !== 1 ? "s" : ""}
            </p>
          )}
        </TabsContent>
      </Tabs>

      <DeliveryReasonDialog
        open={reasonTarget !== null}
        onOpenChange={(open) => {
          if (!open) setReasonTarget(null);
        }}
        mode={reasonTarget?.mode ?? "retry"}
        loading={retry.isPending || cancel.isPending}
        onConfirm={async ({ reason }) => {
          if (!reasonTarget) return;
          const payload = {
            id: reasonTarget.message.id,
            expectedVersion:
              reasonTarget.message.actionRequirements?.expectedVersion ??
              reasonTarget.message.version,
            reason,
          };
          if (reasonTarget.mode === "retry") {
            await retry.mutateAsync(payload);
          } else {
            await cancel.mutateAsync(payload);
          }
          setReasonTarget(null);
        }}
      />
    </PageContainer></ModuleCapabilityGate>
  );
}
