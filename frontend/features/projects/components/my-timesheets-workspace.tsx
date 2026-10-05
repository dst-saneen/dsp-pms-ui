"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { StatusBadge } from "@/components/common/status-badge";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getApiErrorMessage } from "@/services/api-client";
import { toast } from "sonner";

import { PROJECTS_ROUTES } from "../constants/permissions";
import {
  createOperationId,
  hasAllowedAction,
} from "../lib/allowed-actions";
import { statusToneFor } from "../lib/status-tone";
import { projectsKeys } from "../hooks/query-keys";
import { useMyProjectTasks, useMyTimesheets } from "../hooks/use-projects";
import { TimesheetsApiService } from "../services/timesheets-api.service";
import type { Timesheet, TimesheetLine } from "../types/project.types";
import { ProjectsPathBanner } from "./projects-path-banner";

type LineTarget = "TASK" | "CATEGORY";

export function MyTimesheetsWorkspace() {
  const searchParams = useSearchParams();
  const prefTaskId = searchParams.get("taskId") ?? "";
  const query = useMyTimesheets();
  const myTasksQuery = useMyProjectTasks();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [periodStart, setPeriodStart] = useState("");
  const [lineOpen, setLineOpen] = useState(false);
  const [linesOpen, setLinesOpen] = useState(false);
  const [selected, setSelected] = useState<Timesheet | null>(null);
  const [editingLine, setEditingLine] = useState<TimesheetLine | null>(null);
  const [removeTarget, setRemoveTarget] = useState<TimesheetLine | null>(null);
  const [workDate, setWorkDate] = useState("");
  const [hours, setHours] = useState("8");
  const [lineTarget, setLineTarget] = useState<LineTarget>("TASK");
  const [taskId, setTaskId] = useState(prefTaskId);
  const [workCategoryId, setWorkCategoryId] = useState("");

  useEffect(() => {
    if (prefTaskId) {
      // URL search params are external route state synchronized by this effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTaskId(prefTaskId);
    }
  }, [prefTaskId]);

  const invalidate = () =>
    void queryClient.invalidateQueries({
      queryKey: projectsKeys.myTimesheets(),
    });

  const createMutation = useMutation({
    mutationFn: () =>
      TimesheetsApiService.create({
        periodStart,
        operationId: createOperationId(),
      }),
    onSuccess: () => {
      toast.success("Timesheet created");
      setCreateOpen(false);
      invalidate();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const saveLineMutation = useMutation({
    mutationFn: () => {
      const taskTarget = lineTarget === "TASK" ? taskId.trim() : "";
      const categoryTarget =
        lineTarget === "CATEGORY" ? workCategoryId.trim() : "";
      if (editingLine) {
        return TimesheetsApiService.updateLine(selected!.id, editingLine.id, {
          workDate,
          hours,
          taskId: taskTarget || null,
          workCategoryId: categoryTarget || null,
          expectedVersion: selected!.actionRequirements.expectedVersion,
          lineExpectedVersion: editingLine.version,
          operationId: createOperationId(),
        });
      }
      return TimesheetsApiService.addLine(selected!.id, {
        workDate,
        hours,
        taskId: taskTarget || undefined,
        workCategoryId: categoryTarget || undefined,
        expectedVersion: selected!.actionRequirements.expectedVersion,
        operationId: createOperationId(),
      });
    },
    onSuccess: () => {
      toast.success(editingLine ? "Line updated" : "Line added");
      setLineOpen(false);
      setEditingLine(null);
      invalidate();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
      invalidate();
    },
  });

  const removeLineMutation = useMutation({
    mutationFn: () =>
      TimesheetsApiService.removeLine(selected!.id, removeTarget!.id, {
        expectedVersion: selected!.actionRequirements.expectedVersion,
        operationId: createOperationId(),
      }),
    onSuccess: () => {
      toast.success("Line removed");
      setRemoveTarget(null);
      setLinesOpen(false);
      invalidate();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
      invalidate();
    },
  });

  const submitMutation = useMutation({
    mutationFn: (sheet: Timesheet) =>
      TimesheetsApiService.submit(sheet.id, {
        expectedVersion: sheet.actionRequirements.expectedVersion,
        operationId: createOperationId(),
      }),
    onSuccess: () => {
      toast.success("Timesheet submitted");
      invalidate();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
      invalidate();
    },
  });

  const items = query.data?.items ?? [];
  const myTasks = myTasksQuery.data?.items ?? [];
  const lineTargetId =
    lineTarget === "TASK" ? taskId.trim() : workCategoryId.trim();

  function openLineEditor(sheet: Timesheet, line?: TimesheetLine) {
    setSelected(sheet);
    setEditingLine(line ?? null);
    setWorkDate(line?.workDate ?? sheet.periodStart);
    setHours(line?.hours ?? "8");
    setLineTarget(line?.workCategoryId ? "CATEGORY" : "TASK");
    setTaskId(line?.taskId ?? prefTaskId);
    setWorkCategoryId(line?.workCategoryId ?? "");
    setLinesOpen(false);
    setLineOpen(true);
  }

  function lineTargetLabel(line: TimesheetLine) {
    if (line.taskId) {
      const task = myTasks.find((item) => item.id === line.taskId);
      if (task) {
        return `${task.projectName ?? task.projectCode ?? "Project"} — ${task.taskName}`;
      }
      return `Task ${line.taskId}`;
    }
    return line.workCategoryId
      ? `Work category ${line.workCategoryId}`
      : "No charge target";
  }

  return (
    <WorkspaceShell>
      <ProjectsPathBanner
        current="my-timesheets"
        note="Create a week → Add line (pick your assigned task) → Submit. Approver uses Team timesheets. Full timesheet wave is W15; this path is enough for W14 smoke."
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          Prefer charging time to a task from{" "}
          <Link className="underline" href={PROJECTS_ROUTES.myProjects}>
            My projects
          </Link>
          .
        </p>
        <Button onClick={() => setCreateOpen(true)}>New timesheet</Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead>Hours</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isLoading ? (
              <TableRow>
                <TableCell colSpan={4}>Loading timesheets…</TableCell>
              </TableRow>
            ) : query.error ? (
              <TableRow>
                <TableCell colSpan={4} className="text-destructive">
                  {getApiErrorMessage(query.error)}
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  No timesheets yet. Click <strong>New timesheet</strong>, then
                  Add line for each work day.
                </TableCell>
              </TableRow>
            ) : (
              items.map((sheet) => (
                <TableRow key={sheet.id}>
                  <TableCell>
                    {sheet.periodStart} → {sheet.periodEnd}
                  </TableCell>
                  <TableCell>{sheet.totalHours}</TableCell>
                  <TableCell>
                    <StatusBadge
                      label={sheet.status}
                      tone={statusToneFor(sheet.status)}
                    />
                  </TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelected(sheet);
                        setLinesOpen(true);
                      }}
                    >
                      View lines
                    </Button>
                    {hasAllowedAction(sheet.allowedActions, "EDIT") ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openLineEditor(sheet)}
                      >
                        Add line
                      </Button>
                    ) : null}
                    {hasAllowedAction(sheet.allowedActions, "SUBMIT") ? (
                      <Button
                        size="sm"
                        disabled={submitMutation.isPending}
                        onClick={() => submitMutation.mutate(sheet)}
                      >
                        Submit
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create weekly timesheet</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Period start (week)</Label>
            <Input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!periodStart || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={linesOpen} onOpenChange={setLinesOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Timesheet lines</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {selected?.lines.length ? (
              selected.lines.map((line) => (
                <div
                  key={line.id}
                  className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1 text-sm">
                    <p className="font-medium">
                      {line.workDate} · {line.hours} hours
                    </p>
                    <p className="text-muted-foreground">{lineTargetLabel(line)}</p>
                    {line.remarks ? <p>{line.remarks}</p> : null}
                  </div>
                  {selected && hasAllowedAction(selected.allowedActions, "EDIT") ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openLineEditor(selected, line)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setRemoveTarget(line)}
                      >
                        Remove
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">No lines recorded for this week.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinesOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={lineOpen} onOpenChange={setLineOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingLine ? "Edit timesheet line" : "Add timesheet line"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="timesheet-work-date">Work date</Label>
              <Input
                id="timesheet-work-date"
                type="date"
                value={workDate}
                onChange={(e) => setWorkDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timesheet-hours">Hours</Label>
              <Input
                id="timesheet-hours"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Charge to</legend>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="lineTarget"
                    checked={lineTarget === "TASK"}
                    onChange={() => setLineTarget("TASK")}
                  />
                  Assigned task
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="lineTarget"
                    checked={lineTarget === "CATEGORY"}
                    onChange={() => setLineTarget("CATEGORY")}
                  />
                  Work category ID
                </label>
              </div>
            </fieldset>
            {lineTarget === "TASK" ? (
              <div className="space-y-2">
                <Label>Task</Label>
                {myTasks.length > 0 ? (
                  <select
                    aria-label="Task"
                    className="flex h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                    value={taskId}
                    onChange={(e) => setTaskId(e.target.value)}
                  >
                    <option value="">Select assigned task…</option>
                    {myTasks.map((task) => (
                      <option key={task.id} value={task.id}>
                        {(task.projectName ?? task.projectCode ?? "Project") +
                          " — " +
                          task.taskName}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-muted-foreground text-xs">
                    No assigned tasks in My projects. Get assigned first, or
                    paste a Task ID below.
                  </p>
                )}
                <Input
                  aria-label="Task ID"
                  placeholder="Or paste Task ID"
                  value={taskId}
                  onChange={(e) => setTaskId(e.target.value)}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Work Category ID</Label>
                <Input
                  aria-label="Work category ID"
                  value={workCategoryId}
                  onChange={(e) => setWorkCategoryId(e.target.value)}
                />
                <p className="text-muted-foreground text-xs">
                  Category time is advanced setup. Prefer Assigned task for W14.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLineOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                !workDate ||
                !hours ||
                !lineTargetId ||
                saveLineMutation.isPending
              }
              onClick={() => saveLineMutation.mutate()}
            >
              {editingLine ? "Save changes" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove timesheet line</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Remove {removeTarget?.hours} hours from {removeTarget?.workDate}? This updates the
            weekly total.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>
              Keep line
            </Button>
            <Button
              variant="destructive"
              disabled={removeLineMutation.isPending}
              onClick={() => removeLineMutation.mutate()}
            >
              Remove line
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkspaceShell>
  );
}
