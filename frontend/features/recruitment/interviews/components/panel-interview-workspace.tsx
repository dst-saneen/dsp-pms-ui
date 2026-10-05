"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/providers/auth-provider";

import { InterviewStatusBadge } from "../../components/interview-status-badge";
import { RECRUITMENT_ROUTES } from "../../constants/routes";
import {
  INTERVIEW_EVALUATION_STATUS,
  INTERVIEW_SESSION_STATUS,
} from "../../types/enums";
import { useAssignedInterviews } from "../hooks/use-interviews";
import {
  canEditEvaluation,
  findMyEvaluation,
} from "../utils/evaluation-readonly";
import { EvaluationStatusBadge } from "./evaluation-status-badge";

export function PanelInterviewWorkspace() {
  const { user } = useAuth();
  const employeeId = user?.employeeId;
  const assignedQuery = useAssignedInterviews(employeeId);

  if (!employeeId) {
    return (
      <p className="text-sm text-muted-foreground">
        Link your user account to an employee record to see assigned interviews.
      </p>
    );
  }

  if (assignedQuery.isLoading) {
    return (
      <p className="text-sm text-muted-foreground">
        Loading assigned interviews…
      </p>
    );
  }

  const sessions = (() => {
    const pending = (assignedQuery.data ?? []).flatMap((session) => {
      const evaluation = findMyEvaluation(session, employeeId);
      if (!evaluation) return [];

      const isActive =
        session.status === INTERVIEW_SESSION_STATUS.SCHEDULED ||
        session.status === INTERVIEW_SESSION_STATUS.RESCHEDULED;
      const isMyEvaluationPending =
        evaluation.status !== INTERVIEW_EVALUATION_STATUS.SUBMITTED;

      return isActive || isMyEvaluationPending ? [{ session, evaluation }] : [];
    });

    const latestByRound = new Map<string, (typeof pending)[number]>();
    for (const item of pending) {
      const key = `${item.session.jobApplicationId}:${item.session.roundNumber}`;
      const existing = latestByRound.get(key);
      if (
        !existing ||
        new Date(item.session.scheduledStartAt).getTime() >
          new Date(existing.session.scheduledStartAt).getTime()
      ) {
        latestByRound.set(key, item);
      }
    }

    return [...latestByRound.values()].sort(
      (left, right) =>
        new Date(left.session.scheduledStartAt).getTime() -
        new Date(right.session.scheduledStartAt).getTime(),
    );
  })();

  if (sessions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No active interview panel assignments right now.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {sessions.map(({ session, evaluation }) => {
        const editable = canEditEvaluation({
          session,
          evaluation,
          employeeId,
        });

        return (
          <Card key={session.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">
                  R{session.roundNumber} · {session.roundName}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {session.candidateName} · {session.openingTitle}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <InterviewStatusBadge status={session.status} />
                <EvaluationStatusBadge status={evaluation.status} />
              </div>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" asChild>
                <Link href={RECRUITMENT_ROUTES.interviews.detail(session.id)}>
                  Open interview
                </Link>
              </Button>
              <Button size="sm" asChild>
                <Link href={RECRUITMENT_ROUTES.interviews.evaluate(session.id)}>
                  {editable ? "Evaluate" : "View evaluation"}
                </Link>
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
