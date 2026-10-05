"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  Laptop,
  Search,
} from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge, type StatusTone } from "@/components/common/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getApiErrorMessage } from "@/services/api-client";

import { onboardingTaskKeys } from "../hooks/query-keys";
import { getRenderableTaskActions, TASK_ACTION_LABELS } from "../lib/task-actions";
import { OnboardingApiService } from "../services/onboarding-api.service";
import type {
  EmployeeOnboardingTaskAllowedAction,
  EmployeeOnboardingTaskRuntimeView,
  EmployeeOnboardingTaskStatus,
  MyOnboardingTasksQuery,
} from "../types/onboarding.types";
import { OnboardingTaskDrawer } from "./OnboardingTaskDrawer";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

const STATUS_FILTERS: Array<{
  value: EmployeeOnboardingTaskStatus;
  label: string;
}> = [
  { value: "PENDING", label: "To do" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "COMPLETED", label: "Completed" },
];

const STATUS_PRESENTATION: Record<
  EmployeeOnboardingTaskStatus,
  { label: string; tone: StatusTone }
> = {
  PENDING: { label: "To do", tone: "neutral" },
  IN_PROGRESS: { label: "In progress", tone: "information" },
  COMPLETED: { label: "Completed", tone: "success" },
  SKIPPED: { label: "Skipped", tone: "neutral" },
  WAIVED: { label: "Waived", tone: "warning" },
  CANCELLED: { label: "Cancelled", tone: "danger" },
};

function getPrimaryAction(task: EmployeeOnboardingTaskRuntimeView) {
  const actions = getRenderableTaskActions(task);
  const order: EmployeeOnboardingTaskAllowedAction[] = [
    "START",
    "FULFILL_ASSET",
    "COMPLETE",
    "REOPEN",
    "ASSIGN",
    "REASSIGN",
    "UNASSIGN",
    "SKIP",
    "WAIVE",
  ];

  return order
    .map((action) => actions.find((item) => item.action === action))
    .find(Boolean);
}

function TaskIcon({ workType }: { workType: "CHECKLIST" | "ASSET" }) {
  const Icon = workType === "ASSET" ? Laptop : FileText;

  return (
    <span className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-lg">
      <Icon className="text-muted-foreground size-4" />
    </span>
  );
}

function DueDate({ task }: { task: EmployeeOnboardingTaskRuntimeView }) {
  if (!task.dueDate) {
    return <span className="text-muted-foreground">Not set</span>;
  }

  return (
    <div className="space-y-1">
      <p>{format(new Date(task.dueDate), "dd MMM yyyy")}</p>
      {task.dueState === "OVERDUE" ? (
        <span className="text-xs font-medium text-rose-600">Overdue</span>
      ) : null}
      {task.dueState === "DUE_SOON" ? (
        <span className="text-xs font-medium text-amber-600">Due soon</span>
      ) : null}
    </div>
  );
}

interface MyOnboardingTasksProps {
  initialTaskId?: string | null;
}

export function MyOnboardingTasks({ initialTaskId }: MyOnboardingTasksProps) {
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<EmployeeOnboardingTaskStatus>("PENDING");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<number>(10);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    initialTaskId ?? null,
  );
  const [drawerOpen, setDrawerOpen] = useState(Boolean(initialTaskId));
  const [initialAction, setInitialAction] =
    useState<EmployeeOnboardingTaskAllowedAction | null>(null);

  const filters = useMemo<MyOnboardingTasksQuery>(
    () => ({
      keyword: keyword.trim() || undefined,
      status,
      page,
      limit,
      sortBy: "dueDate",
      sortOrder: "asc",
    }),
    [keyword, status, page, limit],
  );

  const query = useQuery({
    queryKey: onboardingTaskKeys.me(filters),
    queryFn: () => OnboardingApiService.getMyTasks(filters),
  });

  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / limit));

  const openTask = (
    taskId: string,
    action: EmployeeOnboardingTaskAllowedAction | null = null,
  ) => {
    setInitialAction(action);
    setSelectedTaskId(taskId);
    setDrawerOpen(true);
  };

  const renderAction = (task: EmployeeOnboardingTaskRuntimeView) => {
    const primaryAction = getPrimaryAction(task);

    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => openTask(task.id, primaryAction?.action ?? null)}
      >
        {primaryAction ? TASK_ACTION_LABELS[primaryAction.action] : "View details"}
      </Button>
    );
  };

  return (
    <Card
      id="my-onboarding-tasks"
      className="gap-0 overflow-hidden py-0 shadow-none"
    >
      <CardHeader className="border-b px-4 py-4 md:px-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <CardTitle role="heading" aria-level={2}>
              My onboarding tasks
            </CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">
              Complete the assigned steps below to finish your onboarding.
            </p>
          </div>
          <div className="relative w-full xl:max-w-xs">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={keyword}
              onChange={(event) => {
                setKeyword(event.target.value);
                setPage(1);
              }}
              placeholder="Search tasks..."
              aria-label="Search onboarding tasks"
              className="pl-9"
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2" aria-label="Task status filters">
          {STATUS_FILTERS.map((filter) => (
            <Button
              key={filter.value}
              type="button"
              size="sm"
              variant={status === filter.value ? "secondary" : "outline"}
              className={
                status === filter.value
                  ? "border-primary/15 bg-primary-soft text-primary hover:bg-primary-soft"
                  : undefined
              }
              aria-pressed={status === filter.value}
              onClick={() => {
                setStatus(filter.value);
                setPage(1);
              }}
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </CardHeader>

      {query.isLoading ? (
        <CardContent className="space-y-3 py-5">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="bg-muted h-12 animate-pulse rounded-lg" />
          ))}
        </CardContent>
      ) : null}

      {query.error ? (
        <CardContent className="py-8">
          <EmptyState
            icon={ClipboardList}
            title="Could not load tasks"
            description={getApiErrorMessage(
              query.error,
              "We could not load your onboarding tasks.",
            )}
            actionLabel="Retry"
            onAction={() => {
              void query.refetch();
            }}
          />
        </CardContent>
      ) : null}

      {query.data && query.data.items.length === 0 ? (
        <CardContent className="py-12">
          <EmptyState
            icon={ClipboardList}
            title={`No ${STATUS_PRESENTATION[status].label.toLowerCase()} tasks`}
            description="There are no onboarding tasks in this group."
          />
        </CardContent>
      ) : null}

      {query.data && query.data.items.length > 0 ? (
        <>
          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Due date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.items.map((task) => {
                  const presentation = STATUS_PRESENTATION[task.status];

                  return (
                    <TableRow key={task.id}>
                      <TableCell>
                        <div className="flex items-start gap-3">
                          <TaskIcon workType={task.requirement.workType} />
                          <div className="min-w-0">
                            <button
                              type="button"
                              className="text-left font-medium hover:underline"
                              onClick={() => openTask(task.id)}
                            >
                              {task.taskName}
                            </button>
                            <p className="text-muted-foreground mt-0.5 text-xs">
                              {task.employee.displayName}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{task.workstreamDepartment.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-normal">
                          {task.requirement.workType === "ASSET" ? "Asset" : "Checklist"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DueDate task={task} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          label={presentation.label}
                          tone={presentation.tone}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">{renderAction(task)}</div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="divide-y md:hidden">
            {query.data.items.map((task) => {
              const presentation = STATUS_PRESENTATION[task.status];

              return (
                <div key={task.id} className="space-y-4 p-4">
                  <div className="flex items-start gap-3">
                    <TaskIcon workType={task.requirement.workType} />
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        className="text-left font-medium hover:underline"
                        onClick={() => openTask(task.id)}
                      >
                        {task.taskName}
                      </button>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {task.workstreamDepartment.name} · {task.employee.displayName}
                      </p>
                    </div>
                    <StatusBadge
                      label={presentation.label}
                      tone={presentation.tone}
                      className="shrink-0"
                    />
                  </div>
                  <div className="flex items-end justify-between gap-3">
                    <div className="text-sm">
                      <p className="text-muted-foreground mb-1 text-xs">Due date</p>
                      <DueDate task={task} />
                    </div>
                    {renderAction(task)}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : null}

      {query.data && query.data.total > 0 ? (
        <div className="border-t px-4 py-3 md:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground text-sm">
              Showing {(query.data.page - 1) * limit + 1} to{" "}
              {Math.min(query.data.page * limit, query.data.total)} of {query.data.total}{" "}
              tasks
            </p>
            <div className="flex items-center gap-2">
              <Select
                value={String(limit)}
                onValueChange={(value) => {
                  setLimit(Number(value));
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[86px]" aria-label="Tasks per page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Previous page"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft />
              </Button>
              <span className="min-w-8 text-center text-sm font-medium">{page}</span>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Next page"
                disabled={page >= totalPages}
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <OnboardingTaskDrawer
        taskId={selectedTaskId}
        open={drawerOpen}
        initialAction={initialAction}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) {
            setInitialAction(null);
          }
        }}
      />
    </Card>
  );
}
