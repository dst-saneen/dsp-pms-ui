"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

import { StatusBadge } from "@/components/common/status-badge";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getApiErrorMessage } from "@/services/api-client";

import { onboardingTaskKeys } from "../hooks/query-keys";
import { resolveTaskActionCapability } from "../lib/task-actions";
import { OnboardingApiService } from "../services/onboarding-api.service";
import type {
  EmployeeOnboardingTaskAllowedAction,
  RuntimeActionCapability,
  EmployeeOnboardingTaskRuntimeView,
} from "../types/onboarding.types";
import { OnboardingTaskActionBar } from "./OnboardingTaskActionBar";
import { OnboardingTaskCommandPanel } from "./OnboardingTaskCommandPanel";

interface OnboardingTaskDrawerProps {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialAction?: EmployeeOnboardingTaskAllowedAction | null;
}

function isCurrentRuntimeTask(
  task: Awaited<ReturnType<typeof OnboardingApiService.getTaskDetail>>,
): task is EmployeeOnboardingTaskRuntimeView {
  return task.contractVersion === "V2";
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border bg-background px-3 py-2">
      <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

export function OnboardingTaskDrawer(props: OnboardingTaskDrawerProps) {
  const initialAction = props.initialAction ?? null;
  const key = props.open
    ? `${props.taskId ?? "none"}:${initialAction ?? "none"}`
    : "closed";

  return (
    <OnboardingTaskDrawerContent
      key={key}
      {...props}
      initialAction={initialAction}
    />
  );
}

function OnboardingTaskDrawerContent({
  taskId,
  open,
  onOpenChange,
  initialAction = null,
}: OnboardingTaskDrawerProps) {
  const [pendingAction, setPendingAction] = useState<{
    action: EmployeeOnboardingTaskAllowedAction;
    capability: RuntimeActionCapability<EmployeeOnboardingTaskAllowedAction>;
  } | null>(null);
  const [initialActionDismissed, setInitialActionDismissed] = useState(false);

  const taskQuery = useQuery({
    queryKey: onboardingTaskKeys.detail(taskId ?? ""),
    queryFn: () => OnboardingApiService.getTaskDetail(taskId!),
    enabled: open && Boolean(taskId),
  });

  const historyQuery = useQuery({
    queryKey: onboardingTaskKeys.history(taskId ?? "", 1, 20),
    queryFn: () =>
      OnboardingApiService.getTaskHistory(taskId!, {
        page: 1,
        limit: 20,
        sortOrder: "desc",
      }),
    enabled: open && Boolean(taskId) && taskQuery.data?.contractVersion === "V2",
  });

  const task = taskQuery.data;
  const currentRuntimeTask = task && isCurrentRuntimeTask(task) ? task : null;

  const initialPendingAction =
    !initialActionDismissed && currentRuntimeTask && initialAction
      ? (() => {
          const capability = resolveTaskActionCapability(currentRuntimeTask, initialAction);
          return capability ? { action: initialAction, capability } : null;
        })()
      : null;
  const activePendingAction = pendingAction ?? initialPendingAction;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-xl"
      >
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle>{currentRuntimeTask?.taskName ?? "Onboarding task"}</SheetTitle>
          <SheetDescription>
            Review the task, then assign or act from the panel below.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 px-6 py-5">
          {taskQuery.isLoading ? (
            <div className="text-muted-foreground animate-pulse text-sm">
              Loading task detail...
            </div>
          ) : null}

          {taskQuery.error ? (
            <p className="text-destructive text-sm">
              {getApiErrorMessage(taskQuery.error, "Could not load task detail.")}
            </p>
          ) : null}

          {task?.contractVersion === "LEGACY_V1" ? (
            <div className="space-y-3">
              <Badge variant="secondary">Imported — read only</Badge>
              <p className="text-muted-foreground text-sm">
                This imported task is available for review only. Actions are not
                available for this task; contact HR if it needs to be updated.
              </p>
            </div>
          ) : null}

          {currentRuntimeTask ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge label={currentRuntimeTask.status} tone="neutral" />
                <Badge variant="outline">{currentRuntimeTask.ownerType}</Badge>
                <Badge variant="outline">{currentRuntimeTask.requirement.workType}</Badge>
                {currentRuntimeTask.isMandatory ? (
                  <Badge variant="destructive">Mandatory</Badge>
                ) : null}
                {currentRuntimeTask.dueState !== "NONE" ? (
                  <Badge variant="secondary">{currentRuntimeTask.dueState}</Badge>
                ) : null}
              </div>

              {currentRuntimeTask.description ? (
                <p className="text-muted-foreground text-sm">
                  {currentRuntimeTask.description}
                </p>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <DetailField
                  label="Employee"
                  value={`${currentRuntimeTask.employee.displayName} (${currentRuntimeTask.employee.employeeCode})`}
                />
                <DetailField
                  label="Assignee"
                  value={currentRuntimeTask.assignee?.displayName ?? "Unassigned"}
                />
                <DetailField
                  label="Workstream"
                  value={currentRuntimeTask.workstreamDepartment.name}
                />
                <DetailField
                  label="Executor department"
                  value={currentRuntimeTask.executorDepartment?.name ?? "Not set"}
                />
                <DetailField
                  label="Due date"
                  value={
                    currentRuntimeTask.dueDate
                      ? format(new Date(currentRuntimeTask.dueDate), "dd MMM yyyy")
                      : "Not set"
                  }
                />
                <DetailField label="Record revision" value={String(currentRuntimeTask.version)} />
              </div>

              {currentRuntimeTask.dependency ? (
                <div className="rounded-lg border p-3 text-sm">
                  <div className="font-medium">Dependency</div>
                  <p className="text-muted-foreground mt-1">
                    {currentRuntimeTask.dependency.taskName} · {currentRuntimeTask.dependency.status} ·{" "}
                    {currentRuntimeTask.dependency.satisfied ? "Satisfied" : "Blocked"}
                  </p>
                </div>
              ) : null}

              {currentRuntimeTask.blockedReasons.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Blocked reasons</div>
                  {currentRuntimeTask.blockedReasons.map((reason) => (
                    <p
                      key={reason.code}
                      className="text-destructive rounded-md border border-destructive/20 bg-destructive/5 p-2 text-sm"
                    >
                      {reason.message}
                    </p>
                  ))}
                </div>
              ) : null}

              {activePendingAction ? (
                <OnboardingTaskCommandPanel
                  task={currentRuntimeTask}
                  action={activePendingAction.action}
                  capability={activePendingAction.capability}
                  onCancel={() => {
                    if (pendingAction) {
                      setPendingAction(null);
                      return;
                    }
                    setInitialActionDismissed(true);
                  }}
                  onCompleted={() => {
                    setPendingAction(null);
                    setInitialActionDismissed(true);
                    onOpenChange(false);
                  }}
                />
              ) : (
                <div className="rounded-xl border p-4">
                  <div className="mb-3 text-sm font-medium">Actions</div>
                  <OnboardingTaskActionBar
                    task={currentRuntimeTask}
                    pending={taskQuery.isFetching}
                    layout="row"
                    showAuthorityBadge={false}
                    onAction={(action, capability) => {
                      setPendingAction({ action, capability });
                    }}
                  />
                </div>
              )}

              <div className="space-y-3">
                <div className="text-sm font-medium">History</div>
                {historyQuery.isLoading ? (
                  <p className="text-muted-foreground text-sm">
                    Loading history...
                  </p>
                ) : null}
                {historyQuery.error ? (
                  <p className="text-destructive text-sm">
                    {getApiErrorMessage(
                      historyQuery.error,
                      "Could not load task history.",
                    )}
                  </p>
                ) : null}
                {historyQuery.data?.items.length ? (
                  <ul className="space-y-2 text-sm">
                    {historyQuery.data.items.map((entry) => (
                      <li key={entry.id} className="rounded-md border p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{entry.action}</Badge>
                          <span className="text-muted-foreground">
                            {format(
                              new Date(entry.createdAt),
                              "dd MMM yyyy HH:mm",
                            )}
                          </span>
                        </div>
                        <p className="text-muted-foreground mt-1">
                          {entry.actor.displayName} · Revision {entry.taskVersionAfter}
                        </p>
                        {entry.reason ? (
                          <p className="mt-1">{entry.reason}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : historyQuery.isSuccess ? (
                  <p className="text-muted-foreground text-sm">No history yet.</p>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
