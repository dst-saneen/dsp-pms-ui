"use client";

import { useState } from "react";
import Link from "next/link";

import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/providers/auth-provider";

import { InterviewStatusBadge } from "../../components/interview-status-badge";
import { RECRUITMENT_PERMISSIONS } from "../../constants/permissions";
import { RECRUITMENT_ROUTES } from "../../constants/routes";
import { InterviewActionDialog } from "../dialogs/interview-action-dialog";
import { ScheduleInterviewDialog } from "../dialogs/schedule-interview-dialog";
import {
  useApplicationInterviews,
  useCancelInterview,
  useCompleteInterview,
  useRescheduleInterview,
} from "../hooks/use-interviews";
import type { InterviewSession } from "../types/interview";
import {
  canEditEvaluation,
  findMyEvaluation,
  isInterviewActionable,
} from "../utils/evaluation-readonly";
import { EvaluationForm } from "./evaluation-form";
import { EvaluationStatusBadge } from "./evaluation-status-badge";

interface ApplicationInterviewsPanelProps {
  applicationId: string;
}

function formatDateTime(value: string, timezone: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleString()} (${timezone})`;
}

export function ApplicationInterviewsPanel({
  applicationId,
}: ApplicationInterviewsPanelProps) {
  const { hasPermission, user } = useAuth();
  const canManage = hasPermission(RECRUITMENT_PERMISSIONS.manage);
  const employeeId = user?.employeeId;
  const interviewsQuery = useApplicationInterviews(applicationId);
  const rescheduleMutation = useRescheduleInterview();
  const cancelMutation = useCancelInterview();
  const completeMutation = useCompleteInterview();

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<InterviewSession | null>(
    null,
  );
  const [actionMode, setActionMode] = useState<"reschedule" | "cancel" | null>(
    null,
  );
  const [completeSession, setCompleteSession] = useState<InterviewSession | null>(
    null,
  );

  const sessions = interviewsQuery.data ?? [];

  return (
    <div className="space-y-4">
      {canManage ? (
        <Button onClick={() => setScheduleOpen(true)}>Schedule interview</Button>
      ) : null}

      {sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No interviews scheduled yet.
        </p>
      ) : (
        sessions.map((session) => {
          const myEvaluation = findMyEvaluation(session, employeeId);
          const canEvaluate =
            myEvaluation &&
            canEditEvaluation({
              session,
              evaluation: myEvaluation,
              employeeId,
            });

          return (
            <Card key={session.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">
                    <Link
                      href={RECRUITMENT_ROUTES.interviews.detail(session.id)}
                      className="hover:text-primary hover:underline"
                    >
                      R{session.roundNumber} · {session.roundName}
                    </Link>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {formatDateTime(session.scheduledStartAt, session.timezone)}
                  </p>
                </div>
                <InterviewStatusBadge status={session.status} />
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>
                  Mode: {session.mode.replaceAll("_", " ")} · Panel:{" "}
                  {session.panelMembers
                    .map((member) => member.employeeName)
                    .join(", ")}
                </p>
                <p>Evaluation deadline: {session.evaluationDeadline}</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <Link href={RECRUITMENT_ROUTES.interviews.detail(session.id)}>
                      Open detail
                    </Link>
                  </Button>

                  {canEvaluate ? (
                    <Button size="sm" asChild>
                      <Link
                        href={RECRUITMENT_ROUTES.interviews.evaluate(session.id)}
                      >
                        Evaluate
                      </Link>
                    </Button>
                  ) : null}

                  {canManage && isInterviewActionable(session.status) ? (
                    <>
                      <Button
                        size="sm"
                        onClick={() => setCompleteSession(session)}
                        disabled={completeMutation.isPending}
                      >
                        Mark complete
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedSession(session);
                          setActionMode("reschedule");
                        }}
                      >
                        Reschedule
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setSelectedSession(session);
                          setActionMode("cancel");
                        }}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      <ScheduleInterviewDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        defaultApplicationId={applicationId}
      />

      <InterviewActionDialog
        open={actionMode !== null}
        onOpenChange={(open) => {
          if (!open) {
            setActionMode(null);
            setSelectedSession(null);
          }
        }}
        session={selectedSession}
        mode={actionMode ?? "cancel"}
        loading={rescheduleMutation.isPending || cancelMutation.isPending}
        onConfirm={async (values) => {
          if (!selectedSession || !actionMode) return;

          if (actionMode === "reschedule") {
            await rescheduleMutation.mutateAsync({
              id: selectedSession.id,
              applicationId: selectedSession.jobApplicationId,
              data: {
                version: selectedSession.version,
                scheduledDate: values.scheduledDate!,
                scheduledTime: values.scheduledTime!,
                durationMinutes: values.durationMinutes!,
                timezone: values.timezone!,
                reason: values.reason,
              },
            });
          } else {
            await cancelMutation.mutateAsync({
              id: selectedSession.id,
              applicationId: selectedSession.jobApplicationId,
              data: {
                version: selectedSession.version,
                reason: values.reason,
              },
            });
          }

          setActionMode(null);
          setSelectedSession(null);
        }}
      />

      <ConfirmActionDialog
        open={completeSession !== null}
        onOpenChange={(open) => {
          if (!open) setCompleteSession(null);
        }}
        title="Mark interview complete"
        message="Confirm this interview is finished so evaluations and manager review can proceed."
        name={completeSession?.roundName ?? ""}
        code={
          completeSession ? `R${completeSession.roundNumber}` : undefined
        }
        confirmLabel="Mark complete"
        loading={completeMutation.isPending}
        onConfirm={() => {
          if (!completeSession) return;
          completeMutation.mutate(
            {
              id: completeSession.id,
              applicationId: completeSession.jobApplicationId,
              data: { version: completeSession.version },
            },
            {
              onSuccess: () => setCompleteSession(null),
            },
          );
        }}
      />
    </div>
  );
}

export function ApplicationEvaluationsPanel({
  applicationId,
}: ApplicationInterviewsPanelProps) {
  const { user } = useAuth();
  const employeeId = user?.employeeId;
  const interviewsQuery = useApplicationInterviews(applicationId);
  const sessions = interviewsQuery.data ?? [];

  if (sessions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Evaluations appear after interviews are scheduled.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Assigned panel members score on the dedicated Evaluate page. After every
        required evaluation is submitted, mark the interview complete, then
        advance to manager review.
      </p>
      {sessions.flatMap((session) =>
        session.evaluations.map((evaluation) => {
          if (
            employeeId &&
            evaluation.panelMemberEmployeeId === employeeId &&
            canEditEvaluation({ session, evaluation, employeeId })
          ) {
            return (
              <div key={evaluation.id} className="space-y-2">
                <Button size="sm" asChild>
                  <Link
                    href={RECRUITMENT_ROUTES.interviews.evaluate(session.id)}
                  >
                    Open my evaluation
                  </Link>
                </Button>
                <EvaluationForm
                  session={session}
                  evaluation={evaluation}
                  panelMemberEmployeeId={employeeId}
                />
              </div>
            );
          }

          return (
            <Card key={evaluation.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">
                    <Link
                      href={RECRUITMENT_ROUTES.interviews.detail(session.id)}
                      className="hover:text-primary hover:underline"
                    >
                      {session.roundName} · {evaluation.panelMemberName}
                    </Link>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {evaluation.recommendation?.replaceAll("_", " ") ??
                      "Waiting for this panel member to submit."}
                  </p>
                </div>
                <EvaluationStatusBadge status={evaluation.status} />
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  Weighted total:{" "}
                  {evaluation.weightedTotal ? evaluation.weightedTotal : "—"}
                </p>
                {evaluation.strengths ? (
                  <p>Strengths: {evaluation.strengths}</p>
                ) : null}
                {evaluation.concerns ? (
                  <p>Concerns: {evaluation.concerns}</p>
                ) : null}
                {employeeId &&
                evaluation.panelMemberEmployeeId === employeeId ? (
                  <Button size="sm" variant="outline" asChild>
                    <Link
                      href={RECRUITMENT_ROUTES.interviews.evaluate(session.id)}
                    >
                      View my evaluation
                    </Link>
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          );
        }),
      )}
    </div>
  );
}
