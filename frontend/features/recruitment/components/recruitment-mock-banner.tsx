"use client";

import { isRecruitmentMockEnabled } from "../constants/feature-flags";

/** Visible only in development/test when mock recruitment data is intentionally enabled. */
export function RecruitmentMockBanner() {
  if (!isRecruitmentMockEnabled()) {
    return null;
  }

  return (
    <div
      role="status"
      className="border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-950"
    >
      Development mock mode — recruitment data is local browser mock data, not the live API.
      Set <code className="rounded bg-amber-200/80 px-1">NEXT_PUBLIC_RECRUITMENT_USE_MOCK=false</code>{" "}
      to use the backend.
    </div>
  );
}
