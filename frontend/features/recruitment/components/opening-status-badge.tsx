import {
  StatusBadge,
  type StatusTone,
} from "@/components/common/status-badge";

import { JOB_OPENING_STATUS, type JobOpeningStatus } from "../types";

function formatStatusLabel(status: string) {
  return status
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function getOpeningStatusTone(status: string): StatusTone {
  switch (status.toUpperCase() as JobOpeningStatus) {
    case JOB_OPENING_STATUS.OPEN:
      return "success";
    case JOB_OPENING_STATUS.DRAFT:
      return "neutral";
    case JOB_OPENING_STATUS.ON_HOLD:
      return "warning";
    case JOB_OPENING_STATUS.FILLED:
      return "information";
    case JOB_OPENING_STATUS.CLOSED:
      return "danger";
    default:
      return "neutral";
  }
}

export function OpeningStatusBadge({ status }: { status: string }) {
  return (
    <StatusBadge
      label={formatStatusLabel(status)}
      tone={getOpeningStatusTone(status)}
    />
  );
}
