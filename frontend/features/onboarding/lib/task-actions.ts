import type {
  EmployeeOnboardingTaskAllowedAction,
  RuntimeActionCapability,
} from "../types/onboarding.types";

const KNOWN_TASK_ACTIONS = new Set<EmployeeOnboardingTaskAllowedAction>([
  "ASSIGN",
  "REASSIGN",
  "UNASSIGN",
  "START",
  "COMPLETE",
  "SKIP",
  "REOPEN",
  "FULFILL_ASSET",
  "WAIVE",
]);

export function resolveTaskActionCapability(
  task: {
    allowedActions?: EmployeeOnboardingTaskAllowedAction[];
    actionCapabilities?: Array<
      RuntimeActionCapability<EmployeeOnboardingTaskAllowedAction>
    >;
  },
  action: EmployeeOnboardingTaskAllowedAction,
): RuntimeActionCapability<EmployeeOnboardingTaskAllowedAction> | null {
  if (!KNOWN_TASK_ACTIONS.has(action)) {
    console.warn("[onboarding] Unknown task action ignored:", action);
    return null;
  }

  if (!task.allowedActions?.includes(action)) {
    return null;
  }

  const matches =
    task.actionCapabilities?.filter(
      (capability) => capability.action === action,
    ) ?? [];

  if (matches.length !== 1) {
    console.warn(
      "[onboarding] Action capability mismatch for action:",
      action,
      "matches:",
      matches.length,
    );
    return null;
  }

  return matches[0] ?? null;
}

export function getRenderableTaskActions(
  task: {
    allowedActions?: EmployeeOnboardingTaskAllowedAction[];
    actionCapabilities?: Array<
      RuntimeActionCapability<EmployeeOnboardingTaskAllowedAction>
    >;
  },
): Array<{
  action: EmployeeOnboardingTaskAllowedAction;
  capability: RuntimeActionCapability<EmployeeOnboardingTaskAllowedAction>;
}> {
  const actions = task.allowedActions ?? [];

  return actions.flatMap((action) => {
    const capability = resolveTaskActionCapability(task, action);
    return capability ? [{ action, capability }] : [];
  });
}

export const TASK_ACTION_LABELS: Record<
  EmployeeOnboardingTaskAllowedAction,
  string
> = {
  ASSIGN: "Assign",
  REASSIGN: "Reassign",
  UNASSIGN: "Unassign",
  START: "Start",
  COMPLETE: "Complete",
  SKIP: "Skip",
  REOPEN: "Reopen",
  FULFILL_ASSET: "Fulfill asset",
  WAIVE: "Waive",
};
