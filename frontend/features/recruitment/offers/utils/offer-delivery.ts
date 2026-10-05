import type { OfferDeliveryStatus } from "../types/job-offer";

export function normalizeOfferDeliveryStatus(
  status?: string | null,
  sentAt?: string | null
): OfferDeliveryStatus {
  switch (status) {
    case "NOT_SENT":
    case "QUEUED":
    case "SENT":
    case "FAILED":
    case "BYPASSED":
      return status;
    case "PENDING":
      return "QUEUED";
    case "DELIVERED":
      return "SENT";
    default:
      return sentAt ? "QUEUED" : "NOT_SENT";
  }
}

export function isOfferDeliveryPending(status: OfferDeliveryStatus) {
  return status === "QUEUED";
}

export function isOfferDeliverySent(status: OfferDeliveryStatus) {
  return status === "SENT" || status === "BYPASSED";
}

export function isOfferDeliveryFailed(status: OfferDeliveryStatus) {
  return status === "FAILED";
}

export function formatOfferDeliveryStatus(status: OfferDeliveryStatus) {
  switch (status) {
    case "NOT_SENT":
      return "Not sent";
    case "QUEUED":
      return "Queued";
    case "SENT":
      return "Sent";
    case "FAILED":
      return "Failed";
    case "BYPASSED":
      return "Sent";
    default:
      return status;
  }
}
