"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Users } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import { PageToolbar } from "@/components/common/page-toolbar";
import { Badge } from "@/components/ui/badge";
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
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/services/api-client";

import { onboardingTaskKeys } from "../hooks/query-keys";
import { OnboardingApiService } from "../services/onboarding-api.service";
import type {
  DepartmentOnboardingQueueQuery,
  EmployeeOnboardingTaskAllowedAction,
} from "../types/onboarding.types";
import { OnboardingTaskActionBar } from "./OnboardingTaskActionBar";
import { OnboardingTaskDrawer } from "./OnboardingTaskDrawer";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export function DepartmentOnboardingQueue({
  initialTaskId,
}: {
  initialTaskId?: string | null;
}) {
  return (
    <DepartmentOnboardingQueueContent
      key={initialTaskId ?? "queue"}
      initialTaskId={initialTaskId}
    />
  );
}

function DepartmentOnboardingQueueContent({
  initialTaskId,
}: {
  initialTaskId?: string | null;
}) {
  const [keyword, setKeyword] = useState("");
  const [assignmentState, setAssignmentState] = useState<string>(
    initialTaskId ? "ALL" : "UNASSIGNED",
  );
  const [dueState, setDueState] = useState<string>("ALL");
  const [workType, setWorkType] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<number>(10);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    initialTaskId ?? null,
  );
  const [drawerOpen, setDrawerOpen] = useState(Boolean(initialTaskId));
  const [initialAction, setInitialAction] =
    useState<EmployeeOnboardingTaskAllowedAction | null>(
      initialTaskId ? "ASSIGN" : null,
    );

  const filters = useMemo<DepartmentOnboardingQueueQuery>(
    () => ({
      keyword: keyword.trim() || undefined,
      assignmentState:
        assignmentState === "ALL"
          ? undefined
          : (assignmentState as DepartmentOnboardingQueueQuery["assignmentState"]),
      dueState:
        dueState === "ALL"
          ? undefined
          : (dueState as DepartmentOnboardingQueueQuery["dueState"]),
      workType:
        workType === "ALL"
          ? undefined
          : (workType as DepartmentOnboardingQueueQuery["workType"]),
      page,
      limit,
      sortBy: "dueDate",
      sortOrder: "asc",
    }),
    [keyword, assignmentState, dueState, workType, page, limit],
  );

  const query = useQuery({
    queryKey: onboardingTaskKeys.departmentQueue(filters),
    queryFn: () => OnboardingApiService.getDepartmentQueue(filters),
  });

  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / limit));

  return (
    <WorkspaceShell>
      <PageToolbar>
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Department Queue</h2>
          <p className="text-muted-foreground text-sm">
            Unassigned department work for this onboarding. Assign each task to
            someone in the executor department.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-end">
          <Input
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value);
              setPage(1);
            }}
            placeholder="Search employee or task name"
            className="max-w-sm"
          />
          <Select
            value={assignmentState}
            onValueChange={(value) => {
              setAssignmentState(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Assignment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All assignments</SelectItem>
              <SelectItem value="UNASSIGNED">Unassigned</SelectItem>
              <SelectItem value="ASSIGNED">Assigned</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={dueState}
            onValueChange={(value) => {
              setDueState(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Due state" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All due states</SelectItem>
              <SelectItem value="DUE_SOON">Due soon</SelectItem>
              <SelectItem value="OVERDUE">Overdue</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={workType}
            onValueChange={(value) => {
              setWorkType(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Work type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All work types</SelectItem>
              <SelectItem value="CHECKLIST">Checklist</SelectItem>
              <SelectItem value="ASSET">Asset</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </PageToolbar>

      {query.isLoading ? (
        <div className="bg-muted h-48 animate-pulse rounded-xl" />
      ) : null}

      {query.error ? (
        <EmptyState
          icon={Users}
          title="Could not load department queue"
          description={getApiErrorMessage(
            query.error,
            "We could not load your department onboarding queue.",
          )}
          actionLabel="Retry"
          onAction={() => {
            void query.refetch();
          }}
        />
      ) : null}

      {query.data && query.data.items.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No department work"
          description="No onboarding work matches this Department filter."
        />
      ) : null}

      {query.data && query.data.items.length > 0 ? (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead className="hidden md:table-cell">Employee</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead className="hidden lg:table-cell">Department</TableHead>
                <TableHead className="hidden sm:table-cell">Due</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.items.map((task) => (
                <TableRow key={task.id}>
                  <TableCell>
                    <button
                      type="button"
                      className="text-left font-medium hover:underline"
                    onClick={() => {
                      setInitialAction(null);
                      setSelectedTaskId(task.id);
                      setDrawerOpen(true);
                    }}
                    >
                      {task.taskName}
                    </button>
                    <p className="text-muted-foreground text-xs">
                      {task.requirement.workType} · {task.status}
                    </p>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {task.employee.displayName}
                  </TableCell>
                  <TableCell>
                    {task.assignee?.displayName ? (
                      <span className="text-sm">{task.assignee.displayName}</span>
                    ) : (
                      <Badge variant="outline">Unassigned</Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {task.executorDepartment?.name ??
                      task.workstreamDepartment.name}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {task.dueDate
                      ? format(new Date(task.dueDate), "dd MMM yyyy")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <OnboardingTaskActionBar
                      task={task}
                      layout="row"
                      compact
                      showAuthorityBadge={false}
                      onAction={(action) => {
                        setInitialAction(action);
                        setSelectedTaskId(task.id);
                        setDrawerOpen(true);
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {query.data ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted-foreground text-sm">
            Page {query.data.page} of {totalPages} · {query.data.total} total
          </p>
          <div className="flex items-center gap-2">
            <Select
              value={String(limit)}
              onValueChange={(value) => {
                setLimit(Number(value));
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[100px]">
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
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
            >
              Next
            </Button>
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
    </WorkspaceShell>
  );
}
