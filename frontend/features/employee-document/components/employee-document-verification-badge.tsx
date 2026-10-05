"use client";

import { Badge } from "@/components/ui/badge";

interface Props {
  status: string;
}

export function EmployeeDocumentVerificationBadge({
  status,
}: Props) {
  switch (status) {
    case "VERIFIED":
      return (
        <Badge variant="default">
          Verified
        </Badge>
      );

    case "REJECTED":
      return (
        <Badge variant="destructive">
          Rejected
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