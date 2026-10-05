"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { EditorHeader } from "@/components/editor/editor-header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/auth-provider";
import { getApiErrorMessage } from "@/services/api-client";

import { InterviewStatusBadge } from "../../components/interview-status-badge";
import { RECRUITMENT_ROUTES } from "../../constants/routes";
import { useInterviewSession } from "../hooks/use-interviews";
import {
  canEditEvaluation,
  findMyEvaluation,
  findPanelMember,
  isEvaluationReadOnly,
} from "../utils/evaluation-readonly";
import { EvaluationForm } from "./evaluation-form";

interface InterviewEvaluateProps {
  interviewId: string;
}

export function InterviewEvaluate({ interviewId }: InterviewEvaluateProps) {
  const router = useRouter();
  const { user } = useAuth();
  const employeeId = user?.employeeId;
  const sessionQuery = useInterviewSession(interviewId);

  if (sessionQuery.isLoading) {
    return <div className="p-6">Loading evaluation…</div>;
  }

  if (sessionQuery.error || !sessionQuery.data) {
    return (
      <div className="space-y-3 p-6">
        <p className="font-medium">Interview not found</p>
        <p className="text-muted-foreground text-sm">
          {sessionQuery.error
            ? getApiErrorMessage(
                sessionQuery.error,
                "We could not load this interview.",
              )
            : "This interview is unavailable."}
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

  const session = sessionQuery.data;
  const membership = findPanelMember(session, employeeId);
  const evaluation = findMyEvaluation(session, employeeId);

  if (!employeeId || !membership || !evaluation) {
    return (
      <div className="space-y-4">
        <EditorHeader
          title="Evaluate interview"
          subtitle={`${session.roundName} · ${session.candidateName}`}
          actions={<InterviewStatusBadge status={session.status} />}
        />
        <p className="text-sm text-muted-foreground">
          Only assigned panel members can open this evaluation. Ask HR to add
          you to the panel if you expected access.
        </p>
        <Button asChild variant="outline">
          <Link href={RECRUITMENT_ROUTES.interviews.detail(session.id)}>
            Back to interview
          </Link>
        </Button>
      </div>
    );
  }

  const editable = canEditEvaluation({
    session,
    evaluation,
    employeeId,
  });

  return (
    <div className="space-y-6">
      <EditorHeader
        title={`Evaluate · R${session.roundNumber} ${session.roundName}`}
        subtitle={`${session.candidateName} · ${session.openingTitle}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <InterviewStatusBadge status={session.status} />
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                router.push(RECRUITMENT_ROUTES.interviews.detail(session.id))
              }
            >
              Back to interview
            </Button>
          </div>
        }
      />

      <p className="text-muted-foreground text-sm">
        {editable
          ? "Score this candidate, save a draft, then submit. Submitted evaluations become read-only."
          : isEvaluationReadOnly(evaluation.status)
            ? "Your evaluation is submitted and read-only."
            : "You can view this evaluation but cannot edit it."}
      </p>

      <EvaluationForm
        session={session}
        evaluation={evaluation}
        panelMemberEmployeeId={employeeId}
      />
    </div>
  );
}
