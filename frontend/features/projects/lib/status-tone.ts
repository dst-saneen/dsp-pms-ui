import type { StatusTone } from "@/components/common/status-badge";

export function statusToneFor(status: string): StatusTone {
  switch (status) {
    case "ACTIVE":
    case "APPROVED":
    case "COMPLETED":
      return "success";
    case "SUBMITTED":
    case "IN_PROGRESS":
    case "ASSIGNED":
      return "progress";
    case "WAITING_REVIEW":
      return "accent";
    case "ON_HOLD":
    case "RETURNED":
    case "DRAFT":
    case "OPEN":
    case "PLANNED":
      return "warning";
    case "CANCELLED":
    case "ENDED":
      return "danger";
    default:
      return "neutral";
  }
}
