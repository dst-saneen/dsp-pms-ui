"use client";

import { Badge } from "@/components/ui/badge";

interface Props {
  status:
    | "pending"
    | "active"
    | "completed"
    | "cancelled";
}

export function WorkflowStageBadge({
  status,
}: Props) {
  switch (status) {
    case "completed":
      return (
        <Badge>
          Completed
        </Badge>
      );

    case "active":
      return (
        <Badge>
          Active
        </Badge>
      );

    case "cancelled":
      return (
        <Badge variant="destructive">
          Cancelled
        </Badge>
      );

    default:
      return (
        <Badge variant="secondary">
          Pending
        </Badge>
      );
  }
}