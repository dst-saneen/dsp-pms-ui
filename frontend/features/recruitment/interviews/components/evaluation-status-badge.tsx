"use client";

import { Badge } from "@/components/ui/badge";

import { INTERVIEW_EVALUATION_STATUS } from "../../types/enums";

export function EvaluationStatusBadge({ status }: { status: string }) {
  const variant =
    status === INTERVIEW_EVALUATION_STATUS.SUBMITTED ? "default" : "secondary";

  return (
    <Badge variant={variant}>
      {status.replaceAll("_", " ")}
    </Badge>
  );
}
