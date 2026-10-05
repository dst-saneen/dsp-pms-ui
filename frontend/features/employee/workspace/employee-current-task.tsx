import { ClipboardCheck, Clock3, FolderKanban } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import {
  StatusBadge,
  type StatusTone,
} from "@/components/common/status-badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import type { WorkspaceCurrentTask } from "./types/employee-workspace";

interface EmployeeCurrentTaskProps {
  task: WorkspaceCurrentTask | null;
}

function getTaskTone(value: string): StatusTone {
  const normalized = value.toLowerCase();
  if (normalized.includes("complete")) return "success";
  if (normalized.includes("high") || normalized.includes("urgent")) {
    return "danger";
  }
  if (normalized.includes("progress")) return "information";
  if (normalized.includes("medium")) return "warning";
  return "neutral";
}

function formatStartedAt(value?: string) {
  if (!value) return "Not started";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function EmployeeCurrentTask({ task }: EmployeeCurrentTaskProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Current Task</CardTitle>
        <p className="text-xs text-muted-foreground">
          Your active work assignment
        </p>
      </CardHeader>

      <CardContent>
        {!task ? (
          <EmptyState
            compact
            icon={ClipboardCheck}
            title="No active task"
            description="Your next assigned task will appear here."
          />
        ) : (
          <div className="space-y-5">
            <div>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h3 className="text-base font-semibold text-foreground">
                  {task.title}
                </h3>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge
                    label={task.priority}
                    tone={getTaskTone(task.priority)}
                  />
                  <StatusBadge
                    label={task.status}
                    tone={getTaskTone(task.status)}
                  />
                </div>
              </div>
              {task.description ? (
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {task.description}
                </p>
              ) : null}
            </div>

            <dl className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
              <div>
                <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                  <FolderKanban className="size-4" aria-hidden="true" />
                  Project
                </dt>
                <dd className="mt-1 text-sm font-medium">
                  {task.project?.projectName ?? "Not assigned"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Stage</dt>
                <dd className="mt-1 text-sm font-medium">
                  {task.stage?.stageName ?? "Not assigned"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Planned hours</dt>
                <dd className="mt-1 text-sm font-medium">
                  {task.plannedHours}
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock3 className="size-4" aria-hidden="true" />
                  Started
                </dt>
                <dd className="mt-1 text-sm font-medium">
                  {formatStartedAt(task.runtime?.startedAt)}
                </dd>
              </div>
            </dl>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
