"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
import { EditorHeader } from "@/components/editor/editor-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/providers/auth-provider";
import { getApiErrorMessage } from "@/services/api-client";

import { InterviewStatusBadge } from "../../components/interview-status-badge";
import { RECRUITMENT_PERMISSIONS } from "../../constants/permissions";
import { RECRUITMENT_ROUTES } from "../../constants/routes";
import { INTERVIEW_EVALUATION_STATUS } from "../../types/enums";
import { InterviewActionDialog } from "../dialogs/interview-action-dialog";
import {
  useCancelInterview,
  useCompleteInterview,
  useInterviewSession,
  useRescheduleInterview,
} from "../hooks/use-interviews";
import {
  canEditEvaluation,
  findMyEvaluation,
  findPanelMember,
  getLeadInterviewerName,
  isInterviewActionable,
} from "../utils/evaluation-readonly";
import { EvaluationStatusBadge } from "./evaluation-status-badge";

interface InterviewDetailProps {
  interviewId: string;
}

function formatDateTime(value: string, timezone: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleString()} (${timezone})`;
}

export function InterviewDetail({ interviewId }: InterviewDetailProps) {
  const router = useRouter();
  const { hasPermission, user } = useAuth();
  const canManage = hasPermission(RECRUITMENT_PERMISSIONS.manage);
  const employeeId = user?.employeeId;

  const sessionQuery = useInterviewSession(interviewId);
  const rescheduleMutation = useRescheduleInterview();
  const cancelMutation = useCancelInterview();
  const completeMutation = useCompleteInterview();

  const [actionMode, setActionMode] = useState<"reschedule" | "cancel" | null>(
    null,
  );
  const [completeOpen, setCompleteOpen] = useState(false);

  const session = sessionQuery.data;
  const isBusy =
    rescheduleMutation.isPending ||
    cancelMutation.isPending ||
    completeMutation.isPending;

  if (sessionQuery.isLoading) {
    return <div className="p-6">Loading interview…</div>;
  }

  if (sessionQuery.error || !session) {
    return (
      <div className="space-y-3 p-6">
        <p className="font-medium">Interview not found</p>
        <p className="text-muted-foreground text-sm">
          {sessionQuery.error
            ? getApiErrorMessage(
                sessionQuery.error,
                "We could not load this interview.",
              )
            : "This interview may have been cancelled or is outside your scope."}
        </p>
        <Button
          variant="outline"
          onClick={() => router.push(RECRUITMENT_ROUTES.interviews.list)}
        >
          Back to interviews
        </Button>
      </div>
    );
  }

  const myMembership = findPanelMember(session, employeeId);
  const myEvaluation = findMyEvaluation(session, employeeId);
  const actionable = isInterviewActionable(session.status);
  const canEvaluate =
    myEvaluation &&
    canEditEvaluation({
      session,
      evaluation: myEvaluation,
      employeeId,
    });
  const canViewMyEvaluation = Boolean(myEvaluation);

  return (
    <div className="space-y-6">
      <EditorHeader
        title={`R${session.roundNumber} · ${session.roundName}`}
        subtitle={`${session.candidateName} · ${session.openingCode} ${session.openingTitle}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <InterviewStatusBadge status={session.status} />
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(RECRUITMENT_ROUTES.interviews.list)}
            >
              Back to list
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Interview details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            <p>
              <span className="text-muted-foreground">When:</span>{" "}
              {formatDateTime(session.scheduledStartAt, session.timezone)}
            </p>
            <p>
              <span className="text-muted-foreground">Mode:</span>{" "}
              {session.mode.replaceAll("_", " ")}
            </p>
            <p>
              <span className="text-muted-foreground">Location / link:</span>{" "}
              {session.locationOrLink ?? "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Evaluation deadline:</span>{" "}
              {formatDateTime(session.evaluationDeadline, session.timezone)}
            </p>
            <p>
              <span className="text-muted-foreground">Required round:</span>{" "}
              {session.isRequired ? "Yes" : "No"}
            </p>
            <p>
              <span className="text-muted-foreground">Lead interviewer:</span>{" "}
              {getLeadInterviewerName(session)}
            </p>
            <p className="sm:col-span-2">
              <span className="text-muted-foreground">Application:</span>{" "}
              <Link
                href={RECRUITMENT_ROUTES.applications.detail(
                  session.jobApplicationId,
                )}
                className="text-primary font-medium hover:underline"
              >
                {session.applicationNumber}
              </Link>
            </p>
            {session.rescheduleReason ? (
              <p className="sm:col-span-2">
                <span className="text-muted-foreground">Reschedule reason:</span>{" "}
                {session.rescheduleReason}
              </p>
            ) : null}
            {session.cancellationReason ? (
              <p className="sm:col-span-2">
                <span className="text-muted-foreground">Cancel reason:</span>{" "}
                {session.cancellationReason}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground text-sm">
              Schedule is only available from the interview calendar. Use these
              controls for Reschedule, Complete, Cancel, or Evaluate.
            </p>
            <div className="flex flex-wrap gap-2">
              {canManage && actionable ? (
                <>
                  <Button
                    type="button"
                    disabled={isBusy}
                    onClick={() => setCompleteOpen(true)}
                  >
                    Mark complete
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isBusy}
                    onClick={() => setActionMode("reschedule")}
                  >
                    Reschedule
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={isBusy}
                    onClick={() => setActionMode("cancel")}
                  >
                    Cancel
                  </Button>
                </>
              ) : null}

              {canEvaluate ? (
                <Button
                  type="button"
                  onClick={() =>
                    router.push(RECRUITMENT_ROUTES.interviews.evaluate(session.id))
                  }
                >
                  Evaluate
                </Button>
              ) : null}

              {!canEvaluate &&
              canViewMyEvaluation &&
              myEvaluation?.status === INTERVIEW_EVALUATION_STATUS.SUBMITTED ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    router.push(RECRUITMENT_ROUTES.interviews.evaluate(session.id))
                  }
                >
                  View my evaluation
                </Button>
              ) : null}
            </div>

            {myMembership ? (
              <p className="text-sm">
                You are on this panel
                {myMembership.isLeadInterviewer ? " as lead interviewer" : ""}.
              </p>
            ) : (
              <p className="text-muted-foreground text-sm">
                You are not an assigned panel member for this interview.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Panel & evaluations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {session.panelMembers.map((member) => {
            const evaluation = session.evaluations.find(
              (item) => item.panelMemberEmployeeId === member.employeeId,
            );
            return (
              <div
                key={member.employeeId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {member.employeeName}
                    {member.isLeadInterviewer ? " · Lead" : ""}
                  </p>
                  <p className="text-muted-foreground">
                    {evaluation?.recommendation?.replaceAll("_", " ") ??
                      "No recommendation yet"}
                    {evaluation?.weightedTotal
                      ? ` · Total ${evaluation.weightedTotal}`
                      : ""}
                  </p>
                </div>
                {evaluation ? (
                  <EvaluationStatusBadge status={evaluation.status} />
                ) : (
                  <span className="text-muted-foreground">No evaluation</span>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <InterviewActionDialog
        open={actionMode !== null}
        onOpenChange={(open) => {
          if (!open) setActionMode(null);
        }}
        session={session}
        mode={actionMode ?? "cancel"}
        loading={isBusy}
        onConfirm={async (values) => {
          if (!actionMode) return;

          if (actionMode === "reschedule") {
            await rescheduleMutation.mutateAsync({
              id: session.id,
              applicationId: session.jobApplicationId,
              data: {
                version: session.version,
                scheduledDate: values.scheduledDate!,
                scheduledTime: values.scheduledTime!,
                durationMinutes: values.durationMinutes!,
                timezone: values.timezone!,
                reason: values.reason,
              },
            });
          } else {
            await cancelMutation.mutateAsync({
              id: session.id,
              applicationId: session.jobApplicationId,
              data: {
                version: session.version,
                reason: values.reason,
              },
            });
          }

          setActionMode(null);
        }}
      />

      <ConfirmActionDialog
        open={completeOpen}
        onOpenChange={setCompleteOpen}
        title="Mark interview complete"
        message="Confirm that the interview happened and required panel work can proceed to manager review when evaluations are submitted."
        name={session.roundName}
        code={`R${session.roundNumber}`}
        confirmLabel="Mark complete"
        loading={completeMutation.isPending}
        onConfirm={() =>
          completeMutation.mutate(
            {
              id: session.id,
              applicationId: session.jobApplicationId,
              data: { version: session.version },
            },
            {
              onSuccess: () => setCompleteOpen(false),
            },
          )
        }
      />
    </div>
  );
}
