"use client";

import { Badge } from "@/components/ui/badge";

interface Props {
  active: boolean;
}

export function OnboardingTemplateStatusBadge({
  active,
}: Props) {
  return (
    <Badge
      variant={
        active ? "default" : "secondary"
      }
    >
      {active ? "Active" : "Inactive"}
    </Badge>
  );
}