import Link from "next/link";

import { ChevronLeft, ChevronRight, Eye, Play, Send } from "lucide-react";

import { StatusBadge } from "@/components/common/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { PROJECTS_ROUTES } from "../constants/permissions";
import { hasAllowedAction } from "../lib/allowed-actions";
import {
  isProjectTaskOverdue,
  normalizeTaskProgress,
  projectTaskStatusLabel,
} from "../lib/my-projects-view-model";
import { statusToneFor } from "../lib/status-tone";
import type { ProjectTask } from "../types/project.types";

export type MyProjectTaskOpenMode = "details" | "submit-review";

interface MyProjectsTaskListProps {
  tasks: readonly ProjectTask[];
  filteredTotal: number;
  page: number;
  pageCount: number;
  pageSize: number;
  businessDate: string;
  startingTaskIds: readonly string[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onOpenTask: (task: ProjectTask, mode: MyProjectTaskOpenMode) => void;
  onStartTask: (task: ProjectTask) => void;
}

function dateKey(value: string | null | undefined): string | null {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (candidate.getUTCFullYear() !== year || candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) return null;
  return match[0];
}

function formatDate(value: string | null | undefined): string {
  const key = dateKey(value);
  if (!key) return "—";
  const [year, month, day] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function overdueLabel(task: ProjectTask, businessDate: string): string | null {
  if (!isProjectTaskOverdue(task, businessDate)) return null;
  const dueDate = dateKey(task.dueDate);
  const today = dateKey(businessDate);
  if (!dueDate || !today) return null;
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${dueDate}T00:00:00Z`)) / 86_400_000);
  return `${days} ${days === 1 ? "day" : "days"} overdue`;
}

function priorityLabel(priority: string | null | undefined): string {
  const value = priority?.trim();
  return value ? value.charAt(0) + value.slice(1).toLowerCase() : "—";
}

function priorityClass(priority: string | null | undefined): string {
  switch (priority?.toUpperCase()) {
    case "URGENT":
    case "HIGH":
      return "bg-danger-soft text-destructive";
    case "MEDIUM":
      return "bg-warning-soft text-warning-foreground";
    case "LOW":
      return "bg-secondary text-secondary-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function Progress({ task }: { task: ProjectTask }) {
  const progress = normalizeTaskProgress(task.completionPercentage);
  return (
    <div className="flex min-w-26 items-center gap-2">
      <div className="h-1.5 min-w-14 flex-1 overflow-hidden rounded-full bg-muted" aria-label={`Progress ${progress}%`}>
        <div className="h-full rounded-full bg-brand-secondary" style={{ width: `${progress}%` }} />
      </div>
      <span className="text-xs text-muted-foreground">{progress}%</span>
    </div>
  );
}

function TaskActions({ task, startingTaskIds, onOpenTask, onStartTask }: Pick<MyProjectsTaskListProps, "startingTaskIds" | "onOpenTask" | "onStartTask"> & { task: ProjectTask }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {hasAllowedAction(task.allowedActions, "START") ? (
        <Button type="button" size="sm" variant="outline" disabled={startingTaskIds.includes(task.id)} onClick={() => onStartTask(task)}>
          <Play aria-hidden="true" />
          Start
        </Button>
      ) : null}
      {hasAllowedAction(task.allowedActions, "SUBMIT_REVIEW") ? (
        <Button type="button" size="sm" onClick={() => onOpenTask(task, "submit-review")}>
          <Send aria-hidden="true" />
          Submit for review
        </Button>
      ) : null}
      {hasAllowedAction(task.allowedActions, "LOG_TIME") ? (
        <Button asChild type="button" size="sm" variant="outline">
          <Link href={`${PROJECTS_ROUTES.myTimesheets}?taskId=${task.id}`}>Log time</Link>
        </Button>
      ) : null}
      <Button type="button" size="sm" variant="outline" onClick={() => onOpenTask(task, "details")}>
        <Eye aria-hidden="true" />
        View
      </Button>
    </div>
  );
}

function DueDate({ task, businessDate }: { task: ProjectTask; businessDate: string }) {
  const overdue = overdueLabel(task, businessDate);
  return <div className={cn(overdue && "text-destructive")}><span>{formatDate(task.dueDate)}</span>{overdue ? <p className="mt-0.5 text-xs font-medium">{overdue}</p> : null}</div>;
}

function DesktopRow({ task, businessDate, startingTaskIds, onOpenTask, onStartTask }: Pick<MyProjectsTaskListProps, "businessDate" | "startingTaskIds" | "onOpenTask" | "onStartTask"> & { task: ProjectTask }) {
  const overdue = isProjectTaskOverdue(task, businessDate);
  return (
    <TableRow className={cn(overdue && "border-l-2 border-l-destructive bg-danger-soft/35 hover:bg-danger-soft/50")}>
      <TableCell className="whitespace-normal"><button type="button" className="max-w-52 text-left font-medium hover:text-primary hover:underline" onClick={() => onOpenTask(task, "details")}>{task.taskName || "Untitled task"}</button><p className="mt-0.5 text-xs text-muted-foreground">{task.taskCode || "—"}</p></TableCell>
      <TableCell className="whitespace-normal"><p className="max-w-44 truncate font-medium">{task.projectName || task.projectCode || "Project unavailable"}</p><p className="mt-0.5 text-xs text-muted-foreground">{task.projectCode || "—"}</p></TableCell>
      <TableCell><Badge className={priorityClass(task.priority)}>{priorityLabel(task.priority)}</Badge></TableCell>
      <TableCell><StatusBadge label={projectTaskStatusLabel(task.status)} tone={statusToneFor(task.status)} /></TableCell>
      <TableCell><Progress task={task} /></TableCell>
      <TableCell><DueDate task={task} businessDate={businessDate} /></TableCell>
      <TableCell><TaskActions task={task} startingTaskIds={startingTaskIds} onOpenTask={onOpenTask} onStartTask={onStartTask} /></TableCell>
    </TableRow>
  );
}

function MobileCard({ task, businessDate, startingTaskIds, onOpenTask, onStartTask }: Pick<MyProjectsTaskListProps, "businessDate" | "startingTaskIds" | "onOpenTask" | "onStartTask"> & { task: ProjectTask }) {
  const overdue = isProjectTaskOverdue(task, businessDate);
  return <article className={cn("rounded-xl border border-border bg-card p-4", overdue && "border-l-2 border-l-destructive bg-danger-soft/35")}>
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><button type="button" className="text-left font-semibold hover:text-primary hover:underline" onClick={() => onOpenTask(task, "details")}>{task.taskName || "Untitled task"}</button><p className="mt-1 text-xs text-muted-foreground">{task.taskCode || "—"}</p></div><Button type="button" size="icon-xs" variant="ghost" aria-label={`View ${task.taskName || "task"}`} onClick={() => onOpenTask(task, "details")}><Eye aria-hidden="true" /></Button></div>
    <p className="mt-3 text-sm font-medium">{task.projectName || task.projectCode || "Project unavailable"}</p><p className="text-xs text-muted-foreground">{task.projectCode || "—"}</p>
    <div className="mt-3 flex flex-wrap gap-2"><StatusBadge label={projectTaskStatusLabel(task.status)} tone={statusToneFor(task.status)} /><Badge className={priorityClass(task.priority)}>{priorityLabel(task.priority)}</Badge></div>
    <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3"><div><p className="text-xs text-muted-foreground">Due date</p><div className="mt-1"><DueDate task={task} businessDate={businessDate} /></div></div><div><p className="text-xs text-muted-foreground">Progress</p><div className="mt-2"><Progress task={task} /></div></div></div>
    <div className="mt-4"><TaskActions task={task} startingTaskIds={startingTaskIds} onOpenTask={onOpenTask} onStartTask={onStartTask} /></div>
  </article>;
}

export function MyProjectsTaskList({ tasks, filteredTotal, page, pageCount, pageSize, businessDate, startingTaskIds, onPageChange, onPageSizeChange, onOpenTask, onStartTask }: MyProjectsTaskListProps) {
  const start = filteredTotal === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, filteredTotal);
  return <div className="mt-4">
    <div data-testid="my-projects-desktop-results" className="hidden md:block"><div className="rounded-xl border border-border"><Table><TableHeader><TableRow><TableHead>Task</TableHead><TableHead>Project</TableHead><TableHead>Priority</TableHead><TableHead>Status</TableHead><TableHead>Progress</TableHead><TableHead>Due date</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>{tasks.map((task) => <DesktopRow key={task.id} task={task} businessDate={businessDate} startingTaskIds={startingTaskIds} onOpenTask={onOpenTask} onStartTask={onStartTask} />)}</TableBody></Table></div></div>
    <div data-testid="my-projects-mobile-results" className="grid gap-3 md:hidden">{tasks.map((task) => <MobileCard key={task.id} task={task} businessDate={businessDate} startingTaskIds={startingTaskIds} onOpenTask={onOpenTask} onStartTask={onStartTask} />)}</div>
    <div className="mt-4 flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><p>Showing {start}–{end} of {filteredTotal} tasks</p><div className="flex flex-wrap items-center gap-2"><Button type="button" size="icon-xs" variant="outline" aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)}><ChevronLeft aria-hidden="true" /></Button><span className="flex size-7 items-center justify-center rounded-lg bg-primary text-xs font-medium text-primary-foreground">{page}</span><Button type="button" size="icon-xs" variant="outline" aria-label="Next page" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}><ChevronRight aria-hidden="true" /></Button><label className="sr-only" htmlFor="my-projects-page-size">Rows per page</label><select id="my-projects-page-size" aria-label="Rows per page" value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} className="h-8 rounded-lg border border-input bg-card px-2 text-xs"><option value={10}>10 per page</option><option value={25}>25 per page</option><option value={50}>50 per page</option></select></div></div>
  </div>;
}
