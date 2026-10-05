"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/page-header";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import { Button } from "@/components/ui/button";
import { useMyWorkspace } from "@/features/my-workspace/hooks/use-my-workspace";
import { cn } from "@/lib/utils";
import { getApiErrorMessage } from "@/services/api-client";

import { PROJECTS_ROUTES } from "../constants/permissions";
import { useMyProjectTasks } from "../hooks/use-projects";
import { projectsKeys } from "../hooks/query-keys";
import { createOperationId } from "../lib/allowed-actions";
import {
  DEFAULT_MY_PROJECTS_FILTERS,
  deriveMyProjectsView,
  paginateMyProjectTasks,
  type MyProjectsFilters as MyProjectsFiltersValue,
} from "../lib/my-projects-view-model";
import { MyProjectsFilters } from "./my-projects-filters";
import { MyProjectsSummary } from "./my-projects-summary";
import {
  MyProjectsTaskList,
  type MyProjectTaskOpenMode,
} from "./my-projects-task-list";
import { MyProjectTaskSheet } from "./my-project-task-sheet";
import type { ProjectTask } from "../types/project.types";
import { ProjectsApiService } from "../services/projects-api.service";

function fallbackBusinessDate(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function activeFilterCount(value: MyProjectsFiltersValue): number {
  return [
    value.keyword.trim().length > 0,
    value.projectId !== "ALL",
    value.status !== "ALL",
    value.priority !== "ALL",
    value.due !== "ALL",
    value.sort !== DEFAULT_MY_PROJECTS_FILTERS.sort,
  ].filter(Boolean).length;
}

export function MyProjectsWorkspace() {
  const tasksQuery = useMyProjectTasks();
  const workspaceQuery = useMyWorkspace();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<MyProjectsFiltersValue>(
    DEFAULT_MY_PROJECTS_FILTERS,
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null);
  const [sheetMode, setSheetMode] =
    useState<MyProjectTaskOpenMode>("details");
  const [startingTaskIds, setStartingTaskIds] = useState<string[]>([]);

  const startTaskMutation = useMutation({
    mutationFn: async (task: ProjectTask) =>
      ProjectsApiService.taskCommand(task.projectId, task.id, "start", {
        expectedVersion: task.actionRequirements.expectedVersion,
        operationId: createOperationId(),
      }),
    onMutate: (task) =>
      setStartingTaskIds((current) =>
        current.includes(task.id) ? current : [...current, task.id],
      ),
    onSuccess: (_result, task) => {
      toast.success("Task started.");
      void queryClient.invalidateQueries({ queryKey: projectsKeys.myTasks() });
      void queryClient.invalidateQueries({ queryKey: projectsKeys.myTask(task.id) });
    },
    onError: (error, task) => {
      toast.error(getApiErrorMessage(error, "Unable to start this task."));
      void queryClient.invalidateQueries({ queryKey: projectsKeys.myTasks() });
      void queryClient.invalidateQueries({ queryKey: projectsKeys.myTask(task.id) });
    },
    onSettled: (_result, _error, task) =>
      setStartingTaskIds((current) => current.filter((id) => id !== task.id)),
  });

  const businessDate = workspaceQuery.data?.businessDate ?? fallbackBusinessDate();
  const view = tasksQuery.data
    ? deriveMyProjectsView(tasksQuery.data.items, filters, businessDate)
    : null;
  const isInitialLoading = tasksQuery.isLoading && !tasksQuery.data;
  const paginated = view
    ? paginateMyProjectTasks(view.filteredTasks, page, pageSize)
    : null;

  const updateFilters = (next: MyProjectsFiltersValue) => {
    setFilters(next);
    setPage(1);
  };

  const clearFilters = () => {
    setFilters(DEFAULT_MY_PROJECTS_FILTERS);
    setPage(1);
  };

  const refreshWorkspace = async () => {
    const refreshes: Array<Promise<unknown>> = [tasksQuery.refetch()];
    if (selectedTask) {
      refreshes.push(
        queryClient.refetchQueries({
          queryKey: projectsKeys.myTask(selectedTask.id),
          type: "active",
        }),
      );
    }
    await Promise.all(refreshes);
  };

  return (
    <WorkspaceShell>
      <PageHeader
        title="My projects"
        description="Track your assigned tasks, complete work, and submit it for review."
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              aria-busy={tasksQuery.isFetching}
              onClick={() => void refreshWorkspace()}
            >
              <RefreshCw
                className={cn(tasksQuery.isFetching && "animate-spin")}
                aria-hidden="true"
              />
              Refresh
            </Button>
            <Button asChild type="button" variant="outline">
              <Link href={PROJECTS_ROUTES.myTimesheets}>My timesheets</Link>
            </Button>
          </>
        }
      />

      <MyProjectsSummary summary={view?.summary ?? null} loading={isInitialLoading} />

      {tasksQuery.error ? (
        <section role="alert" className="rounded-xl border border-destructive/20 bg-danger-soft/40 p-6 text-center">
          <p className="font-medium">Could not load assigned project tasks.</p>
          <p className="mt-1 text-sm text-muted-foreground">{getApiErrorMessage(tasksQuery.error)}</p>
          <Button className="mt-4" type="button" variant="outline" onClick={() => void tasksQuery.refetch()}>
            Retry
          </Button>
        </section>
      ) : isInitialLoading ? (
        <section role="status" className="rounded-xl border border-border bg-card p-6">
          <span className="sr-only">Loading task filters and results</span>
          <div className="h-10 animate-pulse rounded-lg bg-muted" />
          <div className="mt-4 h-36 animate-pulse rounded-lg bg-muted" />
        </section>
      ) : view ? (
        <section className="rounded-xl border border-border bg-card p-3 sm:p-4">
          <div className="mb-4">
            <h2 className="font-heading text-lg font-semibold">My assigned tasks</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              View and manage the project tasks assigned to you.
            </p>
          </div>
          <MyProjectsFilters
            value={filters}
            projectOptions={view.projectOptions}
            priorityOptions={view.priorityOptions}
            activeFilterCount={activeFilterCount(filters)}
            onChange={updateFilters}
            onClear={clearFilters}
          />
          {view.summary.assigned === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center text-center">
              <ClipboardList className="size-8 text-muted-foreground" aria-hidden="true" />
              <p className="mt-3 font-medium">No assigned project tasks are available.</p>
            </div>
          ) : view.filteredTasks.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center text-center">
              <ClipboardList className="size-8 text-muted-foreground" aria-hidden="true" />
              <p className="mt-3 font-medium">No tasks match the current filters.</p>
              <Button className="mt-4" type="button" variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          ) : (
            <MyProjectsTaskList
              tasks={paginated?.items ?? []}
              filteredTotal={view.filteredTasks.length}
              page={paginated?.page ?? 1}
              pageCount={paginated?.pageCount ?? 1}
              pageSize={pageSize}
              businessDate={businessDate}
              startingTaskIds={startingTaskIds}
              onPageChange={setPage}
              onPageSizeChange={(nextPageSize) => {
                setPageSize(nextPageSize);
                setPage(1);
              }}
              onOpenTask={(task, mode) => {
                setSelectedTask(task);
                setSheetMode(mode);
              }}
              onStartTask={(task) => startTaskMutation.mutate(task)}
            />
          )}
        </section>
      ) : null}
      <MyProjectTaskSheet
        open={Boolean(selectedTask)}
        task={selectedTask}
        mode={sheetMode}
        onOpenChange={(open) => {
          if (!open) setSelectedTask(null);
        }}
        onModeChange={setSheetMode}
        onChanged={() => void tasksQuery.refetch()}
      />
    </WorkspaceShell>
  );
}
