import { StatusBadge } from "@/components/common/status-badge";
import type { StatusTone } from "@/components/common/status-badge";
import type { DeliveryMessageStatus } from "../types/delivery";

const STATUS_LABELS: Record<DeliveryMessageStatus, string> = {
  QUEUED: "Queued",
  PROCESSING: "Processing",
  ACCEPTED: "Accepted",
  RETRY_WAIT: "Retry scheduled",
  RECONCILING: "Reconciling",
  BOUNCED_SOFT: "Soft bounce",
  BOUNCED_HARD: "Hard bounce",
  COMPLAINED: "Complained",
  SENDING: "Sending",
  DELIVERED: "Delivered",
  FAILED: "Failed",
  DEAD_LETTER: "Dead letter",
  BYPASSED: "Bypassed",
  CANCELLED: "Cancelled",
};

const STATUS_TONES: Record<DeliveryMessageStatus, StatusTone> = {
  QUEUED: "information",
  PROCESSING: "progress",
  ACCEPTED: "success",
  RETRY_WAIT: "warning",
  RECONCILING: "progress",
  BOUNCED_SOFT: "warning",
  BOUNCED_HARD: "danger",
  COMPLAINED: "danger",
  SENDING: "progress",
  DELIVERED: "success",
  FAILED: "warning",
  DEAD_LETTER: "danger",
  BYPASSED: "neutral",
  CANCELLED: "neutral",
};

interface DeliveryStatusBadgeProps {
  status: DeliveryMessageStatus;
}

export function DeliveryStatusBadge({ status }: DeliveryStatusBadgeProps) {
  return (
    <StatusBadge label={STATUS_LABELS[status] ?? status} tone={STATUS_TONES[status] ?? "neutral"} />
  );
}
