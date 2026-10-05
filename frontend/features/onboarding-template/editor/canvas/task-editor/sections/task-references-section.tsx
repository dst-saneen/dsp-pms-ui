"use client";

import { ContributionSection } from "../contribution";
import { RequirementSection } from "../requirement";

export function TaskReferencesSection() {
  return (
    <div className="space-y-10">
      <ContributionSection />
      <RequirementSection />
    </div>
  );
}
