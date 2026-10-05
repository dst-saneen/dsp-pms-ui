"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { ApplicationStatusBadge } from "../../components/application-status-badge";
import type { HiringComparisonCandidate } from "../types/hiring-decision";
import {
  useHiringComparison,
  useRejectCandidateByManager,
  useSelectCandidate,
} from "../hooks/use-hiring-decisions";
import { CandidateReadinessBadge } from "./candidate-readiness-badge";
import { EvaluationSummaryList } from "./evaluation-summary-list";
import { HiringDecisionDialog } from "./hiring-decision-dialog";

interface HiringComparisonViewProps {
  openingId: string;
  hiringManagerEmployeeId: string;
}

export function HiringComparisonPanel({
  openingId,
  hiringManagerEmployeeId,
}: HiringComparisonViewProps) {
  const comparisonQuery = useHiringComparison(openingId, hiringManagerEmployeeId);
  const selectCandidate = useSelectCandidate(hiringManagerEmployeeId, openingId);
  const rejectCandidate = useRejectCandidateByManager(
    hiringManagerEmployeeId,
    openingId,
  );

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [decisionTarget, setDecisionTarget] = useState<{
    candidate: HiringComparisonCandidate;
    mode: "select" | "reject";
  } | null>(null);

  if (comparisonQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading comparison…</p>;
  }

  const comparison = comparisonQuery.data;
  if (!comparison) {
    return (
      <p className="text-sm text-muted-foreground">
        Unable to load candidate comparison for this opening.
      </p>
    );
  }

  const isBusy = selectCandidate.isPending || rejectCandidate.isPending;
  const readyCount = comparison.candidates.filter(
    (candidate) => candidate.readiness.status === "READY_FOR_DECISION",
  ).length;
  const incompleteCount = comparison.candidates.length - readyCount;
  const selectableCount = comparison.candidates.filter(
    (candidate) => candidate.allowedActions.canSelect,
  ).length;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-muted/30 p-4 text-sm">
        <p className="font-medium">
          {comparison.openingCode} · {comparison.openingTitle}
        </p>
        <p className="text-muted-foreground">
          {comparison.branchName ?? "—"} · Headcount remaining:{" "}
          {comparison.headcountRemaining}
          {comparison.decisionOwnerName
            ? ` · Decision owner: ${comparison.decisionOwnerName}`
            : ""}
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Decision readiness</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <p>
            Ready for decision:{" "}
            <span className="font-medium">{readyCount}</span>
          </p>
          <p>
            Still blocked:{" "}
            <span className="font-medium">{incompleteCount}</span>
          </p>
          <p>
            Selectable now:{" "}
            <span className="font-medium">{selectableCount}</span>
          </p>
          <p>
            Headcount slots:{" "}
            <span className="font-medium">{comparison.headcountRemaining}</span>
          </p>
          {comparison.headcountRemaining <= 0 ? (
            <p className="text-muted-foreground sm:col-span-2 lg:col-span-4">
              Select is blocked while headcount remaining is zero. Reject remains
              available for ready candidates to avoid oversubscription.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {comparison.candidates.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No candidates are currently in interview or manager review for this opening.
        </p>
      ) : (
        comparison.candidates.map((candidate) => {
          const expanded = expandedId === candidate.applicationId;

          return (
            <Card key={candidate.applicationId}>
              <CardHeader className="gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{candidate.candidateName}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {candidate.applicationNumber} · {candidate.candidateEmail}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <ApplicationStatusBadge status={candidate.applicationStatus} />
                    <CandidateReadinessBadge status={candidate.readiness.status} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2 text-sm sm:grid-cols-3">
                  <p>
                    Aggregate score:{" "}
                    {typeof candidate.aggregateScore === "number"
                      ? candidate.aggregateScore.toFixed(1)
                      : "—"}
                  </p>
                  <p>
                    Evaluations: {candidate.readiness.submittedEvaluationsCount}/
                    {candidate.readiness.expectedEvaluationsCount}
                  </p>
                  <p>
                    Required rounds: {candidate.readiness.requiredRoundsCompleted}/
                    {candidate.readiness.requiredRoundsTotal}
                  </p>
                </div>

                <p className="text-sm text-muted-foreground">
                  {candidate.decisionBlockReason ?? candidate.readiness.message}
                </p>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setExpandedId(expanded ? null : candidate.applicationId)
                    }
                  >
                    {expanded ? "Hide details" : "Review summaries"}
                  </Button>

                  {candidate.allowedActions.canSelect ? (
                    <Button
                      size="sm"
                      disabled={isBusy}
                      onClick={() =>
                        setDecisionTarget({ candidate, mode: "select" })
                      }
                    >
                      Select
                    </Button>
                  ) : null}

                  {candidate.allowedActions.canReject ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={isBusy}
                      onClick={() =>
                        setDecisionTarget({ candidate, mode: "reject" })
                      }
                    >
                      Reject
                    </Button>
                  ) : null}
                </div>

                {expanded ? (
                  <EvaluationSummaryList summaries={candidate.evaluationSummaries} />
                ) : null}
              </CardContent>
            </Card>
          );
        })
      )}

      <HiringDecisionDialog
        open={decisionTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDecisionTarget(null);
        }}
        mode={decisionTarget?.mode ?? "select"}
        candidateName={decisionTarget?.candidate.candidateName ?? ""}
        loading={isBusy}
        onConfirm={async (values) => {
          if (!decisionTarget) return;

          const payload = {
            applicationId: decisionTarget.candidate.applicationId,
            data: {
              version: decisionTarget.candidate.version,
              comment: values.comment,
              reasonCode: values.reasonCode,
            },
          };

          if (decisionTarget.mode === "select") {
            await selectCandidate.mutateAsync(payload);
          } else {
            await rejectCandidate.mutateAsync(payload);
          }

          setDecisionTarget(null);
        }}
      />
    </div>
  );
}
