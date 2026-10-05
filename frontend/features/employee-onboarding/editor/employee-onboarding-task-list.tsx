"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { format } from "date-fns";

import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  getRenderableTaskActions,
  TASK_ACTION_LABELS,
} from "@/features/onboarding/lib/task-actions";
import type {
  EmployeeOnboardingTaskAllowedAction,
  RuntimeActionCapability,
} from "@/features/onboarding/types/onboarding.types";

import type { EmployeeOnboardingTask } from "../types/employee-onboarding-task";

type TaskListItem = EmployeeOnboardingTask & {
  allowedActions?: EmployeeOnboardingTaskAllowedAction[];
  actionCapabilities?: Array<
    RuntimeActionCapability<EmployeeOnboardingTaskAllowedAction>
  >;
  contractVersion?: "LEGACY_V1" | "V2";
  requirement?: { workType?: string };
  assignee?: { displayName: string } | null;
  resolvedAt?: string | null;
};

interface EmployeeOnboardingTaskListProps {
  tasks: TaskListItem[];
  onStart: (taskId: string) => Promise<void>;
  onComplete: (taskId: string) => Promise<void>;
  onSkip: (taskId: string, reason: string) => Promise<void>;
  onReopen: (taskId: string, reason: string) => Promise<void>;
}

type PendingAction =
  | {
      type: "complete";
      task: TaskListItem;
    }
  | {
      type: "skip";
      task: TaskListItem;
    }
  | {
      type: "reopen";
      task: TaskListItem;
    };

const DEPARTMENT_QUEUE_HREF =
  "/my-workspace/onboarding?tab=department-queue";

function groupTasksByDepartment(tasks: TaskListItem[]) {
  const groups = new Map<
    string,
    {
      label: string;
      tasks: TaskListItem[];
    }
  >();

  for (const task of tasks) {
    const key = task.assignedDepartmentId ?? "general";

    const label =
      task.assignedDepartment?.departmentName ??
      (task.assignedDepartmentId
        ? `Department ${task.assignedDepartmentId.slice(0, 8)}`
        : "General Tasks");

    if (!groups.has(key)) {
      groups.set(key, {
        label,
        tasks: [],
      });
    }

    groups.get(key)!.tasks.push(task);
  }

  return Array.from(groups.entries()).map(([key, group]) => ({
    key,
    label: group.label,
    tasks: group.tasks.sort((a, b) => a.sequenceNo - b.sequenceNo),
  }));
}

type TaskActionHandlers = Pick<
  EmployeeOnboardingTaskListProps,
  "onStart" | "onComplete" | "onSkip" | "onReopen"
>;

async function runTaskAction(
  action: EmployeeOnboardingTaskAllowedAction,
  task: TaskListItem,
  handlers: TaskActionHandlers,
  reason?: string,
) {
  switch (action) {
    case "START":
      await handlers.onStart(task.id);
      return;
    case "COMPLETE":
      await handlers.onComplete(task.id);
      return;
    case "SKIP":
      if (!reason?.trim()) {
        throw new Error("Reason is required.");
      }
      await handlers.onSkip(task.id, reason.trim());
      return;
    case "REOPEN":
      if (!reason?.trim()) {
        throw new Error("Reason is required.");
      }
      await handlers.onReopen(task.id, reason.trim());
      return;
    default:
      return;
  }
}

function TaskRow({
  task,
  onAction,
}: {
  task: TaskListItem;
  onAction: (
    action: EmployeeOnboardingTaskAllowedAction,
    capability: RuntimeActionCapability<EmployeeOnboardingTaskAllowedAction>,
  ) => void;
}) {
  const actions = getRenderableTaskActions(task).filter(
    ({ action }) =>
      action !== "ASSIGN" &&
      action !== "REASSIGN" &&
      action !== "UNASSIGN",
  );
  const isUnassigned = !task.assignedToUserId && !task.assignee;
  const completedAt = task.resolvedAt ?? task.completedDate;

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">#{task.sequenceNo}</Badge>
            <h3 className="font-medium">{task.taskName}</h3>
            {task.isMandatory ? (
              <Badge variant="destructive">Mandatory</Badge>
            ) : null}
            <Badge variant="outline">{task.status}</Badge>
            {isUnassigned ? (
              <Badge variant="secondary">Unassigned</Badge>
            ) : null}
            {task.contractVersion === "LEGACY_V1" ? (
              <Badge variant="secondary">Imported — read only</Badge>
            ) : null}
          </div>

          {task.description ? (
            <p className="text-sm text-muted-foreground">{task.description}</p>
          ) : null}

          <div className="grid gap-4 text-sm md:grid-cols-4">
            <div>
              <div className="font-medium">Work Type</div>
              <div className="text-muted-foreground">
                {task.requirement?.workType ?? task.workType}
              </div>
            </div>
            <div>
              <div className="font-medium">Owner</div>
              <div className="text-muted-foreground">{task.ownerType ?? "-"}</div>
            </div>
            <div>
              <div className="font-medium">Due Date</div>
              <div className="text-muted-foreground">
                {task.dueDate
                  ? format(new Date(task.dueDate), "dd MMM yyyy")
                  : "-"}
              </div>
            </div>
            <div>
              <div className="font-medium">Completed</div>
              <div className="text-muted-foreground">
                {completedAt
                  ? format(new Date(completedAt), "dd MMM yyyy HH:mm")
                  : "-"}
              </div>
            </div>
          </div>

          {task.remarks ? (
            <div className="rounded-md bg-muted p-3 text-sm">{task.remarks}</div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          {isUnassigned ? (
            <Button type="button" size="sm" asChild>
              <Link href={`${DEPARTMENT_QUEUE_HREF}&taskId=${task.id}`}>
                Assign in Department Queue
              </Link>
            </Button>
          ) : null}
          {actions.map(({ action, capability }) => (
            <Button
              key={action}
              variant={
                action === "COMPLETE" || action === "START"
                  ? "default"
                  : "outline"
              }
              size="sm"
              onClick={() => onAction(action, capability)}
            >
              {TASK_ACTION_LABELS[action]}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function EmployeeOnboardingTaskList({
  tasks,
  onStart,
  onComplete,
  onSkip,
  onReopen,
}: EmployeeOnboardingTaskListProps) {
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const handlers = { onStart, onComplete, onSkip, onReopen };

  const unassignedTasks = useMemo(
    () => tasks.filter((task) => !task.assignedToUserId && !task.assignee),
    [tasks],
  );

  const assignedTasks = useMemo(
    () => tasks.filter((task) => !!task.assignedToUserId || !!task.assignee),
    [tasks],
  );

  const groupedTasks = useMemo(
    () => groupTasksByDepartment(assignedTasks),
    [assignedTasks],
  );

  const handleTaskAction = (
    task: TaskListItem,
    action: EmployeeOnboardingTaskAllowedAction,
  ) => {
    if (action === "SKIP" || action === "REOPEN") {
      setPendingAction({
        type: action === "SKIP" ? "skip" : "reopen",
        task,
      });
      return;
    }

    if (action === "COMPLETE") {
      setPendingAction({ type: "complete", task });
      return;
    }

    void runTaskAction(action, task, handlers);
  };

  const handleConfirm = async () => {
    if (!pendingAction) {
      return;
    }

    setLoading(true);

    try {
      if (pendingAction.type === "complete") {
        await onComplete(pendingAction.task.id);
      }

      if (pendingAction.type === "skip") {
        await onSkip(pendingAction.task.id, reason.trim());
      }

      if (pendingAction.type === "reopen") {
        await onReopen(pendingAction.task.id, reason.trim());
      }

      setPendingAction(null);
      setReason("");
    } finally {
      setLoading(false);
    }
  };

  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No onboarding tasks available.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <Card>
          <CardContent className="space-y-2 pt-6 text-sm">
            <p className="font-medium">How to assign a task to your colleague</p>
            <p className="text-muted-foreground">
              This HR page monitors progress. Assigning people is done in{" "}
              <Link
                href={DEPARTMENT_QUEUE_HREF}
                className="text-foreground underline underline-offset-2"
              >
                My Workspace → Onboarding → Department Queue
              </Link>
              . Open an unassigned department task there, click Assign, and pick
              your colleague.
            </p>
          </CardContent>
        </Card>

        {unassignedTasks.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Unassigned Tasks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {unassignedTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onAction={(action) => handleTaskAction(task, action)}
                />
              ))}
            </CardContent>
          </Card>
        ) : null}

        {groupedTasks.map((group) => (
          <Card key={group.key}>
            <CardHeader>
              <CardTitle>{group.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {group.tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onAction={(action) => handleTaskAction(task, action)}
                />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <ConfirmActionDialog
        open={pendingAction != null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingAction(null);
            setReason("");
          }
        }}
        title={
          pendingAction?.type === "complete"
            ? "Complete task?"
            : pendingAction?.type === "skip"
              ? "Skip task?"
              : "Reopen task?"
        }
        name={pendingAction?.task.taskName ?? "Task"}
        message={
          pendingAction
            ? `${pendingAction.task.taskName} will be updated.`
            : undefined
        }
        confirmLabel={
          pendingAction?.type === "complete"
            ? "Complete"
            : pendingAction?.type === "skip"
              ? "Skip"
              : "Reopen"
        }
        onConfirm={() => {
          void handleConfirm();
        }}
        loading={loading}
      >
        {pendingAction?.type === "skip" || pendingAction?.type === "reopen" ? (
          <Input
            value={reason}
            placeholder="Reason (required)"
            onChange={(event) => setReason(event.target.value)}
          />
        ) : null}
      </ConfirmActionDialog>
    </>
  );
}
