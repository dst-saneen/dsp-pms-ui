"use client";

import { Badge } from "@/components/ui/badge";

interface Props {
  mandatory: boolean;
}

export function OnboardingTemplateTaskStatusBadge({
  mandatory,
}: Props) {
  return (
    <Badge
      variant={
        mandatory
          ? "default"
          : "secondary"
      }
    >
      {mandatory
        ? "Mandatory"
        : "Optional"}
    </Badge>
  );
}