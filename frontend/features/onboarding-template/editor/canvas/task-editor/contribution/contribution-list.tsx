"use client";


import type {
  TaskContribution,
} from "@/features/onboarding-contribution/services/task-contribution.service";

import { ContributionRow } from "./contribution-row";

interface ContributionListProps {

  contributions: TaskContribution[];

}

export function ContributionList({
  contributions,
}: ContributionListProps) {

  if (contributions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">

    {contributions.map(item => (

        <ContributionRow
        key={item.id}
        contribution={item}
        />

    ))}

    </div>
  );

}