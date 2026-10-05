import {
  StatusBadge,
  type StatusTone,
} from "@/components/common/status-badge";

import { JOB_OFFER_STATUS, type JobOfferStatus } from "../types";

function formatStatusLabel(status: string) {
  return status
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function getOfferStatusTone(status: string): StatusTone {
  switch (status.toUpperCase() as JobOfferStatus) {
    case JOB_OFFER_STATUS.ACCEPTED:
      return "success";
    case JOB_OFFER_STATUS.SENT:
      return "progress";
    case JOB_OFFER_STATUS.DRAFT:
      return "neutral";
    case JOB_OFFER_STATUS.DECLINED:
    case JOB_OFFER_STATUS.REVOKED:
    case JOB_OFFER_STATUS.EXPIRED:
      return "danger";
    case JOB_OFFER_STATUS.SUPERSEDED:
      return "warning";
    default:
      return "neutral";
  }
}

export function OfferStatusBadge({ status }: { status: string }) {
  return (
    <StatusBadge
      label={formatStatusLabel(status)}
      tone={getOfferStatusTone(status)}
    />
  );
}
