import {
  StatusBadge,
  type StatusTone,
} from "@/components/common/status-badge";

import type { CandidateReadinessStatus } from "../types/hiring-decision";

function getReadinessTone(status: CandidateReadinessStatus): StatusTone {
  switch (status) {
    case "READY_FOR_DECISION":
      return "success";
    case "NOT_ADVANCED":
      return "progress";
    case "EVALUATIONS_PENDING":
    case "INTERVIEWS_INCOMPLETE":
      return "warning";
    case "ALREADY_DECIDED":
      return "neutral";
    default:
      return "neutral";
  }
}

function formatReadinessLabel(status: CandidateReadinessStatus) {
  switch (status) {
    case "READY_FOR_DECISION":
      return "Ready for decision";
    case "INTERVIEWS_INCOMPLETE":
      return "Interviews incomplete";
    case "EVALUATIONS_PENDING":
      return "Evaluations pending";
    case "NOT_ADVANCED":
      return "Awaiting HR advance";
    case "ALREADY_DECIDED":
      return "Already decided";
    default:
      return status;
  }
}

export function CandidateReadinessBadge({
  status,
}: {
  status: CandidateReadinessStatus;
}) {
  return (
    <StatusBadge
      label={formatReadinessLabel(status)}
      tone={getReadinessTone(status)}
    />
  );
}
