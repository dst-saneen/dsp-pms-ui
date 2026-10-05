import {
  StatusBadge,
  type StatusTone,
} from "@/components/common/status-badge";

import {
  JOB_APPLICATION_STATUS,
  type JobApplicationStatus,
} from "../types";

function formatStatusLabel(status: string) {
  return status
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function getApplicationStatusTone(status: string): StatusTone {
  switch (status.toUpperCase() as JobApplicationStatus) {
    case JOB_APPLICATION_STATUS.HIRED:
    case JOB_APPLICATION_STATUS.OFFER_ACCEPTED:
    case JOB_APPLICATION_STATUS.SELECTED:
      return "success";
    case JOB_APPLICATION_STATUS.APPLIED:
      return "neutral";
    case JOB_APPLICATION_STATUS.SHORTLISTED:
    case JOB_APPLICATION_STATUS.SCREENING:
      return "information";
    case JOB_APPLICATION_STATUS.INTERVIEW:
    case JOB_APPLICATION_STATUS.MANAGER_REVIEW:
    case JOB_APPLICATION_STATUS.OFFER_SENT:
      return "progress";
    case JOB_APPLICATION_STATUS.REJECTED:
    case JOB_APPLICATION_STATUS.WITHDRAWN:
    case JOB_APPLICATION_STATUS.OFFER_DECLINED:
      return "danger";
    default:
      return "neutral";
  }
}

export function ApplicationStatusBadge({ status }: { status: string }) {
  return (
    <StatusBadge
      label={formatStatusLabel(status)}
      tone={getApplicationStatusTone(status)}
    />
  );
}
