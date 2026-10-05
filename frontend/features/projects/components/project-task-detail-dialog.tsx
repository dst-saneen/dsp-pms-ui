"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/common/status-badge";
import { getApiErrorMessage } from "@/services/api-client";

import { hasAllowedAction } from "../lib/allowed-actions";
import { statusToneFor } from "../lib/status-tone";
import { ProjectsApiService } from "../services/projects-api.service";
import type {
  ProjectTaskDetail,
  ProjectTaskDocument,
} from "../types/project.types";
import { ProjectTaskEvidenceUpload } from "./project-task-evidence-upload";

export function ProjectTaskDetailDialog({
  projectId,
  taskId,
  open,
  onOpenChange,
  onChanged,
}: {
  projectId: string;
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}) {
  const detail = useQuery({
    queryKey: ["projects", "task-detail", projectId, taskId],
    queryFn: () => ProjectsApiService.getTask(projectId, taskId!),
    enabled: open && Boolean(taskId),
  });
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  async function download(document: ProjectTaskDocument) {
    if (!taskId) return;
    setDownloadingId(document.id);
    try {
      const grant = await ProjectsApiService.downloadTaskDocument(
        projectId,
        taskId,
        document.id,
      );
      window.open(grant.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, "Unable to download task document."),
      );
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Task detail</DialogTitle>
        </DialogHeader>
        {detail.isLoading ? (
          <div className="bg-muted/40 h-48 animate-pulse rounded-xl" />
        ) : detail.error || !detail.data ? (
          <div className="space-y-3">
            <p className="text-destructive text-sm">
              {getApiErrorMessage(detail.error, "Unable to load task detail.")}
            </p>
            <Button variant="outline" onClick={() => void detail.refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <TaskDetailBody
            task={detail.data}
            projectId={projectId}
            downloadingId={downloadingId}
            onDownload={download}
            onChanged={() => {
              void detail.refetch();
              onChanged?.();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function TaskDetailBody({
  task,
  projectId,
  downloadingId,
  onDownload,
  onChanged,
}: {
  task: ProjectTaskDetail;
  projectId: string;
  downloadingId: string | null;
  onDownload: (document: ProjectTaskDocument) => Promise<void>;
  onChanged: () => void;
}) {
  const documents = useMemo(() => {
    const byId = new Map<string, ProjectTaskDocument>();
    for (const document of task.documents) byId.set(document.id, document);
    for (const submission of task.submissions) {
      for (const document of submission.documents)
        byId.set(document.id, document);
    }
    return [...byId.values()];
  }, [task.documents, task.submissions]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">
            {task.taskCode} · {task.taskName}
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            {task.description || "No description"}
          </p>
        </div>
        <StatusBadge label={task.status} tone={statusToneFor(task.status)} />
      </div>

      <div className="grid gap-3 text-sm sm:grid-cols-3">
        <DetailValue label="Priority" value={task.priority} />
        <DetailValue label="Planned hours" value={task.plannedHours ?? "—"} />
        <DetailValue
          label="Due date"
          value={task.dueDate?.slice(0, 10) ?? "—"}
        />
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-medium">Evidence and documents</h3>
            <p className="text-muted-foreground text-sm">
              Supporting documents are available only through authorized
              short-lived downloads.
            </p>
          </div>
        </div>
        {hasAllowedAction(task.allowedActions, "ATTACH_DOCUMENT") ? (
          <ProjectTaskEvidenceUpload
            projectId={projectId}
            taskId={task.id}
            onChanged={onChanged}
          />
        ) : null}
        {documents.length ? (
          <div className="rounded-lg border">
            {documents.map((document) => (
              <div
                key={document.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b p-3 last:border-0"
              >
                <div>
                  <p className="font-medium">
                    {document.title || "Supporting document"}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {document.documentPurpose} ·{" "}
                    {new Date(document.uploadedAt).toLocaleString()}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={downloadingId === document.id}
                  onClick={() => void onDownload(document)}
                >
                  {downloadingId === document.id ? "Downloading…" : "Download"}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            No task documents linked yet.
          </p>
        )}
      </section>

      <Separator />

      <section className="space-y-3">
        <div>
          <h3 className="font-medium">Assignment history</h3>
          <p className="text-muted-foreground text-sm">
            Server-recorded assignment evidence.
          </p>
        </div>
        {task.assignmentHistory.length ? (
          <div className="space-y-3">
            {task.assignmentHistory.map((event) => (
              <div
                key={event.id}
                className="border-border border-b pb-3 last:border-0"
              >
                <p className="font-medium">{event.action}</p>
                <p className="text-muted-foreground text-sm">
                  Employee {event.employeeId}
                  {event.previousEmployeeId
                    ? ` from ${event.previousEmployeeId}`
                    : ""}
                  {event.remarks ? ` · ${event.remarks}` : ""}
                </p>
                <p className="text-muted-foreground text-xs">
                  {new Date(event.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            No assignment history recorded.
          </p>
        )}
      </section>

      <Separator />

      <section className="space-y-3">
        <div>
          <h3 className="font-medium">Submission and review history</h3>
          <p className="text-muted-foreground text-sm">
            Server-recorded work and review evidence.
          </p>
        </div>
        {task.submissions.length ? (
          <div className="space-y-4">
            {task.submissions.map((submission) => (
              <div key={submission.id} className="rounded-lg border p-3">
                <p className="font-medium">
                  Submission {submission.versionNo} · {submission.status}
                </p>
                <p className="text-muted-foreground text-sm">
                  {submission.submissionNotes || "No submission notes"}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Submitted {new Date(submission.submittedAt).toLocaleString()}
                </p>
                {submission.reviews.length ? (
                  <div className="mt-3 space-y-2 border-l pl-3">
                    {submission.reviews.map((review) => (
                      <p key={review.id} className="text-sm">
                        {review.decision} (round {review.reviewRound})
                        {review.comments ? ` · ${review.comments}` : ""}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            No submissions recorded.
          </p>
        )}
      </section>
    </div>
  );
}

function DetailValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}
