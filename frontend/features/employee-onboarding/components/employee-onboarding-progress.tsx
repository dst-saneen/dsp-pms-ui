"use client";

import { ProgressBar } from "@/components/common/progress-bar";

interface OnboardingProgressProps {
  completed: number;
  total: number;
}

export function OnboardingProgress({
  completed,
  total,
}: OnboardingProgressProps) {
  const percentage =
    total === 0
      ? 0
      : Math.round((completed / total) * 100);

  return (
    <div className="space-y-1">
      <ProgressBar value={percentage} />

      <div className="text-xs text-muted-foreground">
        {completed} / {total} Tasks
      </div>
    </div>
  );
}