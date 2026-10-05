"use client";

import { useEffect, useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { RequiredLabel } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/providers/auth-provider";
import { RECRUITMENT_PERMISSIONS } from "../../constants/permissions";
import { useJobOpening } from "../../openings/hooks/use-job-openings";
import { EVALUATION_RECOMMENDATION_OPTIONS } from "../constants/interview-options";
import {
  useMyInterviewEvaluation,
  useSaveEvaluationDraft,
  useSubmitEvaluation,
} from "../hooks/use-interviews";
import type { InterviewEvaluation, InterviewSession } from "../types/interview";
import { calculateWeightedTotal } from "../utils/evaluation-score";
import {
  canEditEvaluation,
  isEvaluationReadOnly,
} from "../utils/evaluation-readonly";

interface EvaluationFormProps {
  session: InterviewSession;
  evaluation: InterviewEvaluation;
  panelMemberEmployeeId: string;
}

function formatDeadline(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function EvaluationForm({
  session,
  evaluation,
  panelMemberEmployeeId,
}: EvaluationFormProps) {
  const { hasPermission } = useAuth();
  const canReadOpenings = hasPermission(RECRUITMENT_PERMISSIONS.read);
  const myEvaluationQuery = useMyInterviewEvaluation(session.id);
  const openingQuery = useJobOpening(
    canReadOpenings ? session.jobOpeningId : undefined,
  );
  const saveDraft = useSaveEvaluationDraft(panelMemberEmployeeId);
  const submitEvaluation = useSubmitEvaluation(panelMemberEmployeeId);

  const resolvedEvaluation = myEvaluationQuery.data?.evaluation ?? evaluation;
  const criteria = useMemo(() => {
    const fromSelfService = myEvaluationQuery.data?.criteria ?? [];
    if (fromSelfService.length > 0) {
      return fromSelfService.filter((item) => item.isActive);
    }

    return (openingQuery.data?.criteria ?? []).filter((item) => item.isActive);
  }, [myEvaluationQuery.data?.criteria, openingQuery.data?.criteria]);

  const readOnly =
    isEvaluationReadOnly(resolvedEvaluation.status) ||
    !canEditEvaluation({
      session,
      evaluation: resolvedEvaluation,
      employeeId: panelMemberEmployeeId,
    });
  const criteriaLoading =
    myEvaluationQuery.isLoading ||
    (canReadOpenings && openingQuery.isLoading && criteria.length === 0);

  const form = useForm({
    defaultValues: {
      recommendation: resolvedEvaluation.recommendation ?? "",
      strengths: resolvedEvaluation.strengths ?? "",
      concerns: resolvedEvaluation.concerns ?? "",
      confidentialNotes: resolvedEvaluation.confidentialNotes ?? "",
      scores: criteria.map((criterion) => ({
        criterionId: criterion.id,
        score:
          resolvedEvaluation.scores.find((item) => item.criterionId === criterion.id)
            ?.score ?? 0,
      })),
    },
  });

  useEffect(() => {
    form.reset({
      recommendation: resolvedEvaluation.recommendation ?? "",
      strengths: resolvedEvaluation.strengths ?? "",
      concerns: resolvedEvaluation.concerns ?? "",
      confidentialNotes: resolvedEvaluation.confidentialNotes ?? "",
      scores: criteria.map((criterion) => ({
        criterionId: criterion.id,
        score:
          resolvedEvaluation.scores.find((item) => item.criterionId === criterion.id)
            ?.score ?? 0,
      })),
    });
  }, [resolvedEvaluation, criteria, form]);

  const watchedScores = useWatch({
    control: form.control,
    name: "scores",
  });
  const previewTotal = calculateWeightedTotal(
    criteria.map((criterion, index) => ({
      weightPercentage: criterion.weightPercentage,
      score: Number(watchedScores?.[index]?.score ?? 0),
    })),
  );

  const buildPayload = () => {
    const values = form.getValues();
    return {
      version: resolvedEvaluation.version,
      recommendation: values.recommendation || undefined,
      strengths: values.strengths,
      concerns: values.concerns,
      confidentialNotes: values.confidentialNotes,
      scores: values.scores.map((item) => ({
        criterionId: item.criterionId,
        score: Number(item.score),
      })),
    };
  };

  return (
    <form className="space-y-4 rounded-xl border p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">
            R{session.roundNumber} · {session.roundName}
          </p>
          <p className="text-sm text-muted-foreground">
            {session.candidateName} · Deadline {formatDeadline(session.evaluationDeadline)}
          </p>
        </div>
        <div className="rounded-md border px-3 py-1.5 text-sm font-medium">
          Preview total: {previewTotal || "—"}
        </div>
      </div>

      {criteriaLoading ? (
        <p className="text-sm text-muted-foreground">Loading evaluation criteria…</p>
      ) : criteria.length === 0 ? (
        <p className="text-sm text-destructive">
          Evaluation criteria could not be loaded for this interview.
        </p>
      ) : (
        <div className="space-y-3">
          {criteria.map((criterion, index) => (
            <div
              key={criterion.id}
              className="grid gap-3 rounded-lg border p-3 md:grid-cols-[1fr_120px_80px]"
            >
              <div>
                <p className="font-medium">{criterion.name}</p>
                <p className="text-xs text-muted-foreground">
                  Weight {criterion.weightPercentage}%
                </p>
              </div>
              <Input
                type="number"
                min={1}
                max={5}
                disabled={readOnly}
                {...form.register(`scores.${index}.score`, { valueAsNumber: true })}
              />
              <span className="self-center text-sm text-muted-foreground">1–5</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <RequiredLabel>Recommendation</RequiredLabel>
          <Controller
            control={form.control}
            name="recommendation"
            render={({ field }) => (
              <Select
                value={field.value}
                disabled={readOnly}
                onValueChange={field.onChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select recommendation" />
                </SelectTrigger>
                <SelectContent>
                  {EVALUATION_RECOMMENDATION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Strengths</label>
          <Textarea rows={3} disabled={readOnly} {...form.register("strengths")} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Concerns</label>
          <Textarea rows={3} disabled={readOnly} {...form.register("concerns")} />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Confidential notes</label>
        <Textarea
          rows={3}
          disabled={readOnly}
          {...form.register("confidentialNotes")}
        />
      </div>

      {!readOnly ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={
              criteria.length === 0 ||
              saveDraft.isPending ||
              submitEvaluation.isPending
            }
            onClick={() =>
              saveDraft.mutate({
                sessionId: session.id,
                data: buildPayload(),
              })
            }
          >
            Save draft
          </Button>
          <Button
            type="button"
            disabled={
              criteria.length === 0 ||
              saveDraft.isPending ||
              submitEvaluation.isPending
            }
            onClick={() => {
              const payload = buildPayload();
              if (!payload.recommendation) return;
              submitEvaluation.mutate({
                sessionId: session.id,
                data: {
                  ...payload,
                  recommendation: payload.recommendation,
                },
              });
            }}
          >
            Submit evaluation
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Submitted evaluations are read-only.
          {resolvedEvaluation.weightedTotal
            ? ` Final weighted total: ${resolvedEvaluation.weightedTotal}.`
            : ""}
        </p>
      )}
    </form>
  );
}
