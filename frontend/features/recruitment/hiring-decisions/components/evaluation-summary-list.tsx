import type { PermittedEvaluationSummary } from "../types/hiring-decision";

interface EvaluationSummaryListProps {
  summaries: PermittedEvaluationSummary[];
}

function formatRecommendation(value?: string) {
  if (!value) return "—";
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function EvaluationSummaryList({ summaries }: EvaluationSummaryListProps) {
  if (summaries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No submitted evaluations yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {summaries.map((summary, index) => (
        <div
          key={`${summary.roundNumber}-${summary.panelMemberName}-${index}`}
          className="rounded-lg border p-3 text-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">
              R{summary.roundNumber} · {summary.roundName}
            </p>
            <p className="text-muted-foreground">{summary.panelMemberName}</p>
          </div>
          <div className="mt-2 grid gap-1 sm:grid-cols-2">
            <p>
              Score:{" "}
              {typeof summary.weightedTotal === "number"
                ? summary.weightedTotal.toFixed(1)
                : "—"}
            </p>
            <p>Recommendation: {formatRecommendation(summary.recommendation)}</p>
          </div>
          {summary.strengths ? (
            <p className="mt-2 text-muted-foreground">Strengths: {summary.strengths}</p>
          ) : null}
          {summary.concerns ? (
            <p className="text-muted-foreground">Concerns: {summary.concerns}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
