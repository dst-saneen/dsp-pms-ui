"use client";

import { Badge } from "@/components/ui/badge";

interface OnboardingStatusBadgeProps {
  status?: string | null;
}

const STATUS_VARIANTS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  PENDING: "secondary",
  IN_PROGRESS: "default",
  COMPLETED: "outline",
  CANCELLED: "destructive",
};

export function OnboardingStatusBadge({
  status,
}: OnboardingStatusBadgeProps) {
  const normalized = (status ?? "UNKNOWN").toUpperCase();

  return (
    <Badge variant={STATUS_VARIANTS[normalized] ?? "secondary"}>
      {normalized.replaceAll("_", " ")}
    </Badge>
  );
}
