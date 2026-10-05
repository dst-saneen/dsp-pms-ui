"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

import {
  useDeliveryMessages,
  useRetryDelivery,
} from "@/features/delivery/hooks/use-delivery";
import { DeliveryMessageTable } from "@/features/delivery/components/delivery-message-table";
import { DeliveryReasonDialog } from "@/features/delivery/components/delivery-reason-dialog";
import type {
  DeliveryMessage,
  DeliveryMessageStatus,
} from "@/features/delivery/types/delivery";

const STATUS_OPTIONS: { value: "ALL" | DeliveryMessageStatus; label: string }[] =
  [
    { value: "ALL", label: "All statuses" },
    { value: "QUEUED", label: "Queued" },
    { value: "PROCESSING", label: "Processing" },
    { value: "ACCEPTED", label: "Accepted" },
    { value: "RETRY_WAIT", label: "Retry wait" },
    { value: "RECONCILING", label: "Reconciling" },
    { value: "DELIVERED", label: "Delivered" },
    { value: "FAILED", label: "Failed" },
    { value: "DEAD_LETTER", label: "Dead letter" },
    { value: "BOUNCED_SOFT", label: "Soft bounce" },
    { value: "BOUNCED_HARD", label: "Hard bounce" },
    { value: "COMPLAINED", label: "Complained" },
    { value: "BYPASSED", label: "Bypassed" },
    { value: "CANCELLED", label: "Cancelled" },
  ];

function HrDeliveryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"ALL" | DeliveryMessageStatus>(
    (searchParams.get("status") as DeliveryMessageStatus) ?? "ALL",
  );
  const [retryTarget, setRetryTarget] = useState<DeliveryMessage | null>(null);

  const { data, isLoading } = useDeliveryMessages({
    status: status === "ALL" ? undefined : status,
    limit: 50,
  });

  const retry = useRetryDelivery();

  const handleStatusChange = (value: "ALL" | DeliveryMessageStatus) => {
    setStatus(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value === "ALL") {
      params.delete("status");
    } else {
      params.set("status", value);
    }
    router.replace(`?${params.toString()}`);
  };

  return (
    <>
      <div className="mb-4 flex items-center gap-3">
        <Select value={status} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {data ? `${data.total} message${data.total !== 1 ? "s" : ""}` : null}
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <DeliveryMessageTable
          messages={data?.items ?? []}
          detailBasePath="/hr/recruitment/delivery"
          onRetry={(message) => setRetryTarget(message)}
          isRetrying={retry.isPending}
        />
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
    </>
  );
}

export default function HrDeliveryPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Email Delivery"
        description="Track email and notification delivery for recruitment events."
      />
      <div className="mb-4 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
        <p className="text-muted-foreground text-xs">
          This is the HR recruitment view. Platform ops (queue, dead letters,
          suppressions, exceptions) lives under{" "}
          <Link href="/admin/operations/delivery" className="underline">
            Admin → Delivery Queue
          </Link>
          . Empty lists are normal when Delivery Operations is unavailable or no recruitment mail
          has been sent yet.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
        <HrDeliveryContent />
      </Suspense>
    </PageContainer>
  );
}
