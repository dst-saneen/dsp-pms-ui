"use client";

import Link from "next/link";
import { type ReactNode, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  CalendarDays,
  Download,
  FileText,
  Paperclip,
  Send,
} from "lucide-react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/common/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { PROJECTS_ROUTES } from "@/features/projects/constants/permissions";
import { getApiErrorMessage } from "@/services/api-client";

import { createOperationId, hasAllowedAction } from "../lib/allowed-actions";
import {
  normalizeTaskProgress,
  projectTaskStatusLabel,
} from "../lib/my-projects-view-model";
import { statusToneFor } from "../lib/status-tone";
import { ProjectsApiService } from "../services/projects-api.service";
import type {
  ProjectTask,
  ProjectTaskDetail,
  ProjectTaskDocument,
} from "../types/project.types";
import { useMyProjectTask } from "../hooks/use-projects";
import type { MyProjectTaskOpenMode } from "./my-projects-task-list";
import { ProjectTaskEvidenceUpload } from "./project-task-evidence-upload";

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return "—";
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return "—";
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function uniqueDocuments(task: ProjectTaskDetail): ProjectTaskDocument[] {
  const byId = new Map<string, ProjectTaskDocument>();
  task.documents.forEach((document) => byId.set(document.id, document));
  task.submissions.forEach((submission) => {
    submission.documents.forEach((document) => byId.set(document.id, document));
  });
  return [...byId.values()];
}

function priorityClass(priority: string) {
  if (priority === "HIGH" || priority === "URGENT") return "bg-danger-soft text-destructive";
  if (priority === "MEDIUM") return "bg-warning-soft text-warning-foreground";
  return "bg-muted text-muted-foreground";
}

function DetailCell({ label, children }: { label: string; children: ReactNode }) {
  return <div className="border-b border-r border-border p-3 even:border-r-0 sm:odd:border-r"><p className="text-xs text-muted-foreground">{label}</p><div className="mt-1 text-sm font-medium">{children}</div></div>;
}

export function MyProjectTaskSheet({
  open,
  task,
  mode,
  onOpenChange,
  onModeChange,
  onChanged,
}: {
  open: boolean;
  task: ProjectTask | null;
  mode: MyProjectTaskOpenMode;
  onOpenChange: (open: boolean) => void;
  onModeChange: (mode: MyProjectTaskOpenMode) => void;
  onChanged: () => void;
}) {
  const detailQuery = useMyProjectTask(task?.id ?? null, open);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!task || !detailQuery.data) {
        throw new Error("Task details are unavailable.");
      }
      const reason = reviewNote.trim();
      return ProjectsApiService.taskCommand(task.projectId, task.id, "submit-review", {
        expectedVersion: detailQuery.data.actionRequirements.expectedVersion,
        operationId: createOperationId(),
        reason: reason || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Task submitted for review.");
      setReviewNote("");
      void detailQuery.refetch();
      onChanged();
      onOpenChange(false);
    },
    onError: async (error) => {
      toast.error(getApiErrorMessage(error, "Unable to submit this task for review."));
      onChanged();
      const refreshed = await detailQuery.refetch();
      if (
        refreshed.data &&
        !hasAllowedAction(refreshed.data.allowedActions, "SUBMIT_REVIEW")
      ) {
        onModeChange("details");
      }
    },
  });

  async function download(document: ProjectTaskDocument) {
    if (!task) return;
    setDownloadingId(document.id);
    try {
      const grant = await ProjectsApiService.downloadTaskDocument(
        task.projectId,
        task.id,
        document.id,
      );
      window.open(grant.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to download task document."));
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[34rem]"
        aria-label={mode === "submit-review" ? "Review and submit task" : "Task details"}
      >
        <SheetHeader className="border-b border-border pr-12">
          <SheetTitle>{mode === "submit-review" ? "Review & submit" : "Task details"}</SheetTitle>
          <SheetDescription>
            {mode === "submit-review"
              ? "Check your work before sending it for review."
              : "Review the task, evidence, and submission history."}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {detailQuery.isLoading ? (
            <div role="status" className="space-y-4"><span className="sr-only">Loading task details</span><div className="h-28 animate-pulse rounded-xl bg-muted" /><div className="h-44 animate-pulse rounded-xl bg-muted" /></div>
          ) : detailQuery.error || !detailQuery.data || !task ? (
            <div className="flex min-h-56 flex-col items-center justify-center text-center"><p className="font-medium">Could not load task details.</p><p className="mt-1 text-sm text-muted-foreground">{getApiErrorMessage(detailQuery.error, "Please try again.")}</p><Button className="mt-4" type="button" variant="outline" onClick={() => void detailQuery.refetch()}>Retry</Button></div>
          ) : mode === "submit-review" ? (
            <ReviewSubmitContent
              detail={detailQuery.data}
              listTask={task}
              reviewNote={reviewNote}
              onReviewNoteChange={setReviewNote}
              downloadingId={downloadingId}
              onDownload={download}
            />
          ) : (
            <TaskDetailContent
              detail={detailQuery.data}
              listTask={task}
              downloadingId={downloadingId}
              onDownload={download}
              onChanged={() => {
                void detailQuery.refetch();
                onChanged();
              }}
            />
          )}
        </div>

        {detailQuery.data && task ? (
          <SheetFooter className="sticky bottom-0 border-t border-border bg-card sm:flex-row sm:justify-end">
            {mode === "submit-review" ? (
              <><Button type="button" variant="outline" disabled={submitMutation.isPending} onClick={() => onModeChange("details")}>Back</Button><Button type="button" disabled={!hasAllowedAction(detailQuery.data.allowedActions, "SUBMIT_REVIEW") || submitMutation.isPending} onClick={() => submitMutation.mutate()}><Send aria-hidden="true" />{submitMutation.isPending ? "Submitting…" : "Submit for review"}</Button></>
            ) : <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Close</Button>}
            {mode === "details" && hasAllowedAction(detailQuery.data.allowedActions, "LOG_TIME") ? <Button asChild type="button" variant="outline"><Link href={`${PROJECTS_ROUTES.myTimesheets}?taskId=${task.id}`}>Log time</Link></Button> : null}
            {mode === "details" && hasAllowedAction(detailQuery.data.allowedActions, "SUBMIT_REVIEW") ? <Button type="button" onClick={() => onModeChange("submit-review")}><Send aria-hidden="true" />Submit for review</Button> : null}
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function TaskDetailContent({
  detail,
  listTask,
  downloadingId,
  onDownload,
  onChanged,
}: {
  detail: ProjectTaskDetail;
  listTask: ProjectTask;
  downloadingId: string | null;
  onDownload: (document: ProjectTaskDocument) => Promise<void>;
  onChanged: () => void;
}) {
  const documents = useMemo(() => uniqueDocuments(detail), [detail]);
  const progress = normalizeTaskProgress(detail.completionPercentage);

  return <div className="space-y-5">
    <section>
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="font-heading text-lg font-semibold">{detail.taskName || "Untitled task"}</h2><p className="mt-1 text-sm text-muted-foreground">{detail.taskCode || "Task"}</p></div><StatusBadge label={projectTaskStatusLabel(detail.status)} tone={statusToneFor(detail.status)} /></div>
      <p className="mt-4 text-sm text-muted-foreground">{listTask.projectName || listTask.projectCode || "Project unavailable"}{listTask.projectCode ? ` · ${listTask.projectCode}` : ""}</p>
    </section>

    <section aria-labelledby="task-overview-heading"><h3 id="task-overview-heading" className="font-heading font-semibold">Task overview</h3><div className="mt-3 grid grid-cols-2 overflow-hidden rounded-xl border border-border"><DetailCell label="Project">{listTask.projectName || listTask.projectCode || "—"}</DetailCell><DetailCell label="Priority"><Badge className={priorityClass(detail.priority)}>{detail.priority}</Badge></DetailCell><DetailCell label="Due date">{formatDate(detail.dueDate)}</DetailCell><DetailCell label="Planned hours">{detail.plannedHours ? `${detail.plannedHours} hours` : "—"}</DetailCell><DetailCell label="Progress"><div className="flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-brand-secondary" style={{ width: `${progress}%` }} /></div><span className="text-xs">{progress}%</span></div></DetailCell><DetailCell label="Start date">{formatDate(detail.startDate)}</DetailCell></div></section>

    {detail.description ? <section><h3 className="font-heading font-semibold">Description</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{detail.description}</p></section> : null}

    <Separator />
    <section aria-labelledby="task-documents-heading"><div className="flex items-start justify-between gap-3"><div><h3 id="task-documents-heading" className="font-heading font-semibold">Evidence and documents ({documents.length})</h3><p className="mt-1 text-sm text-muted-foreground">Attach supporting files before submitting your work.</p></div><Paperclip className="size-5 text-muted-foreground" aria-hidden="true" /></div><p className="mt-2 text-xs text-muted-foreground">Supported formats: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, JPEG · Maximum 25 MB</p>{hasAllowedAction(detail.allowedActions, "ATTACH_DOCUMENT") ? <div className="mt-3"><ProjectTaskEvidenceUpload projectId={detail.projectId} taskId={detail.id} onChanged={onChanged} /></div> : null}{documents.length ? <div className="mt-3 divide-y rounded-xl border border-border">{documents.map((document) => <div key={document.id} className="flex items-center justify-between gap-3 p-3"><div className="min-w-0"><div className="flex items-center gap-2"><FileText className="size-4 shrink-0 text-primary" aria-hidden="true" /><p className="truncate text-sm font-medium">{document.title || "Supporting document"}</p></div><p className="mt-1 text-xs text-muted-foreground">{document.documentPurpose} · Uploaded {formatDate(document.uploadedAt)}</p></div><Button size="sm" type="button" variant="outline" disabled={downloadingId === document.id} onClick={() => void onDownload(document)}><Download aria-hidden="true" />{downloadingId === document.id ? "Downloading…" : "Download"}</Button></div>)}</div> : <p className="mt-3 text-sm text-muted-foreground">No evidence has been attached yet.</p>}</section>

    <Separator />
    <section aria-labelledby="submission-history-heading"><div className="flex items-center gap-2"><CalendarDays className="size-4 text-muted-foreground" aria-hidden="true" /><h3 id="submission-history-heading" className="font-heading font-semibold">Submission and review history</h3></div>{detail.submissions.length ? <div className="mt-3 space-y-4 border-l border-border pl-4">{detail.submissions.map((submission) => <div key={submission.id}><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium">Submission {submission.versionNo}</p><StatusBadge label={submission.status} tone={statusToneFor(submission.status)} /></div><p className="mt-1 text-xs text-muted-foreground">{formatDate(submission.submittedAt)}</p>{submission.submissionNotes ? <p className="mt-2 text-sm text-muted-foreground">{submission.submissionNotes}</p> : null}{submission.reviews.map((review) => <p key={review.id} className="mt-2 text-sm"><span className="font-medium">{review.decision}</span>{review.comments ? ` · ${review.comments}` : ""}</p>)}</div>)}</div> : <p className="mt-3 text-sm text-muted-foreground">No submissions recorded.</p>}</section>
  </div>;
}

function ReviewSubmitContent({
  detail,
  listTask,
  reviewNote,
  onReviewNoteChange,
  downloadingId,
  onDownload,
}: {
  detail: ProjectTaskDetail;
  listTask: ProjectTask;
  reviewNote: string;
  onReviewNoteChange: (value: string) => void;
  downloadingId: string | null;
  onDownload: (document: ProjectTaskDocument) => Promise<void>;
}) {
  const documents = useMemo(() => uniqueDocuments(detail), [detail]);
  const progress = normalizeTaskProgress(detail.completionPercentage);

  return <div className="space-y-5">
    <section aria-labelledby="review-task-summary-heading"><div className="flex items-start gap-3"><div className="rounded-lg bg-primary-soft p-2"><FileText className="size-5 text-primary" aria-hidden="true" /></div><div className="min-w-0"><h2 id="review-task-summary-heading" className="font-heading font-semibold">Task summary</h2><p className="mt-1 truncate font-medium">{detail.taskName || "Untitled task"}</p><p className="text-xs text-muted-foreground">{detail.taskCode || "Task"}</p></div></div><div className="mt-3 grid grid-cols-2 overflow-hidden rounded-xl border border-border"><DetailCell label="Project">{listTask.projectName || listTask.projectCode || "—"}</DetailCell><DetailCell label="Status"><StatusBadge label={projectTaskStatusLabel(detail.status)} tone={statusToneFor(detail.status)} /></DetailCell><DetailCell label="Priority"><Badge className={priorityClass(detail.priority)}>{detail.priority}</Badge></DetailCell><DetailCell label="Due date">{formatDate(detail.dueDate)}</DetailCell><DetailCell label="Progress"><div className="flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-brand-secondary" style={{ width: `${progress}%` }} /></div><span className="text-xs">{progress}%</span></div></DetailCell><DetailCell label="Planned hours">{detail.plannedHours ? `${detail.plannedHours} hours` : "—"}</DetailCell></div></section>

    <Separator />
    <section aria-labelledby="review-evidence-heading"><h3 id="review-evidence-heading" className="font-heading font-semibold">Evidence and documents ({documents.length})</h3>{documents.length ? <div className="mt-3 divide-y rounded-xl border border-border">{documents.map((document) => <div key={document.id} className="flex items-center justify-between gap-3 p-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{document.title || "Supporting document"}</p><p className="mt-1 text-xs text-muted-foreground">{document.documentPurpose} · Uploaded {formatDate(document.uploadedAt)}</p></div><Button size="sm" type="button" variant="outline" disabled={downloadingId === document.id} onClick={() => void onDownload(document)}><Download aria-hidden="true" />{downloadingId === document.id ? "Downloading…" : "Download"}</Button></div>)}</div> : <p className="mt-2 text-sm text-muted-foreground">No evidence has been attached yet.</p>}</section>

    <Separator />
    <section><label htmlFor="project-task-review-note" className="font-heading font-semibold">Note for reviewer <span className="font-normal text-muted-foreground">(optional)</span></label><Textarea id="project-task-review-note" className="mt-3 min-h-32" value={reviewNote} maxLength={2000} onChange={(event) => onReviewNoteChange(event.target.value)} placeholder="Summarize the work completed or add context for the reviewer." /><p className="mt-1 text-right text-xs text-muted-foreground">{reviewNote.length}/2000</p></section>

    <div role="note" className="rounded-xl bg-primary-soft p-3 text-sm text-primary">Submitting will change this task to Awaiting review and notify the project reviewer.</div>
  </div>;
}
