"use client";

import { useState } from "react";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { ModuleCapabilityGate } from "@/components/common/module-capability-gate";
import { Skeleton } from "@/components/ui/skeleton";

import {
  useDeadLetters,
  useRetryDelivery,
} from "@/features/delivery/hooks/use-delivery";
import { DeliveryMessageTable } from "@/features/delivery/components/delivery-message-table";
import { DeliveryReasonDialog } from "@/features/delivery/components/delivery-reason-dialog";
import { OpsPathBanner } from "@/features/delivery/components/ops-path-banner";
import type { DeliveryMessage } from "@/features/delivery/types/delivery";

export default function DeadLettersPage() {
  const { data, isLoading } = useDeadLetters({ limit: 50 });
  const retry = useRetryDelivery();
  const [retryTarget, setRetryTarget] = useState<DeliveryMessage | null>(null);

  return (
    <ModuleCapabilityGate capability="deliveryOperationsNav"><PageContainer>
      <PageHeader
        title="Dead Letter Queue"
        description="Messages that exhausted all retry attempts. Review and manually retry when the underlying issue is resolved."
      />
      <OpsPathBanner
        current="dead-letters"
        note="Dead letters are exhausted failures. Retry only after the provider/template issue is fixed. Use a unique reason."
      />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <>
          <DeliveryMessageTable
            messages={data?.items ?? []}
            detailBasePath="/admin/operations/delivery"
            onRetry={(message) => setRetryTarget(message)}
            isRetrying={retry.isPending}
            emptyHint="Dead letters stay empty until a message exhausts all retries. Use the queue for active failures."
          />
          {data && (
            <p className="mt-3 text-right text-xs text-muted-foreground">
              {data.total} dead-lettered message{data.total !== 1 ? "s" : ""}
            </p>
          )}
        </>
      )}

      <DeliveryReasonDialog
        open={retryTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRetryTarget(null);
        }}
        mode="retry"
        loading={retry.isPending}
        onConfirm={async ({ reason }) => {
          if (!retryTarget) return;
          await retry.mutateAsync({
            id: retryTarget.id,
            expectedVersion:
              retryTarget.actionRequirements?.expectedVersion ??
              retryTarget.version,
            reason,
          });
          setRetryTarget(null);
        }}
      />
    </PageContainer></ModuleCapabilityGate>
  );
}
