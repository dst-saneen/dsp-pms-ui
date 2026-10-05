"use client";

import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import {
  getRenderableTaskActions,
  TASK_ACTION_LABELS,
} from "../lib/task-actions";
import type {
  EmployeeOnboardingTaskAllowedAction,
  RuntimeActionCapability,
  EmployeeOnboardingTaskRuntimeView,
} from "../types/onboarding.types";

interface OnboardingTaskActionBarProps {
  task: Pick<
    EmployeeOnboardingTaskRuntimeView,
    "allowedActions" | "actionCapabilities" | "requirement"
  >;
  pending?: boolean;
  onAction?: (
    action: EmployeeOnboardingTaskAllowedAction,
    capability: RuntimeActionCapability<EmployeeOnboardingTaskAllowedAction>,
  ) => void;
  layout?: "row" | "column";
  compact?: boolean;
  showAuthorityBadge?: boolean;
  children?: ReactNode;
}

function actionVariant(
  capability: RuntimeActionCapability<EmployeeOnboardingTaskAllowedAction>,
  compact: boolean,
): "default" | "outline" | "destructive" | "secondary" {
  if (capability.confirmationTone === "BREAK_GLASS") {
    return "destructive";
  }

  if (compact && (capability.action === "ASSIGN" || capability.action === "REASSIGN")) {
    return "default";
  }

  if (capability.authorityMode === "HR_OVERRIDE") {
    return "secondary";
  }

  return capability.action === "START" || capability.action === "COMPLETE"
    ? "default"
    : "outline";
}

export function OnboardingTaskActionBar({
  task,
  pending = false,
  onAction,
  layout = "column",
  compact = false,
  showAuthorityBadge = true,
  children,
}: OnboardingTaskActionBarProps) {
  const actions = getRenderableTaskActions(task).filter(({ action }) =>
    compact ? action === "ASSIGN" || action === "REASSIGN" : true,
  );

  if (actions.length === 0 && !children) {
    return null;
  }

  return (
    <div
      className={
        layout === "row"
          ? "flex flex-wrap items-center gap-2"
          : "flex flex-col gap-2"
      }
    >
      {actions.map(({ action, capability }) => (
        <Button
          key={action}
          type="button"
          size="sm"
          variant={actionVariant(capability, compact)}
          disabled={pending}
          onClick={() => onAction?.(action, capability)}
        >
          {compact && (action === "ASSIGN" || action === "REASSIGN")
            ? "Assign"
            : TASK_ACTION_LABELS[action]}
          {showAuthorityBadge && capability.authorityMode === "HR_OVERRIDE" ? (
            <Badge variant="outline" className="ml-2 text-[10px]">
              HR
            </Badge>
          ) : null}
        </Button>
      ))}
      {children}
    </div>
  );
}
