import {
  StatusBadge,
  type StatusTone,
} from "@/components/common/status-badge";

import {
  INTERVIEW_SESSION_STATUS,
  type InterviewSessionStatus,
} from "../types";

function formatStatusLabel(status: string) {
  return status
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function getInterviewStatusTone(status: string): StatusTone {
  switch (status.toUpperCase() as InterviewSessionStatus) {
    case INTERVIEW_SESSION_STATUS.SCHEDULED:
      return "progress";
    case INTERVIEW_SESSION_STATUS.COMPLETED:
      return "success";
    case INTERVIEW_SESSION_STATUS.CANCELLED:
      return "danger";
    case INTERVIEW_SESSION_STATUS.RESCHEDULED:
      return "warning";
    default:
      return "neutral";
  }
}

export function InterviewStatusBadge({ status }: { status: string }) {
  return (
    <StatusBadge
      label={formatStatusLabel(status)}
      tone={getInterviewStatusTone(status)}
    />
  );
}
