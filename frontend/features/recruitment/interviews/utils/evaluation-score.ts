import type { InterviewEvaluationScore } from "../types/interview";

export function calculateWeightedTotal(
  scores: Array<{ weightPercentage: number; score: number }>,
) {
  const active = scores.filter((item) => item.weightPercentage > 0 && item.score > 0);
  if (active.length === 0) return 0;

  const totalWeight = active.reduce((sum, item) => sum + item.weightPercentage, 0);
  const weighted = active.reduce(
    (sum, item) => sum + item.score * item.weightPercentage,
    0,
  );

  return Math.round((weighted / totalWeight) * 100) / 100;
}

export function buildEvaluationScores(
  criteria: Array<{ id: string; name: string; weightPercentage: number }>,
  scoreMap: Record<string, number>,
): InterviewEvaluationScore[] {
  return criteria.map((criterion) => {
    const score = scoreMap[criterion.id] ?? 0;
    const weightedContribution =
      Math.round(((score * criterion.weightPercentage) / 100) * 100) / 100;

    return {
      criterionId: criterion.id,
      criterionName: criterion.name,
      weightPercentage: criterion.weightPercentage,
      score,
      weightedContribution,
    };
  });
}
