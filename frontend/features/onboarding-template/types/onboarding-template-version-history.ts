import type { OnboardingTemplateVersionStatus } from "./onboarding-version";

export interface OnboardingTemplateVersionHistoryItem {
  id: string;

  onboardingTemplateId: string;

  versionNo: number;

  versionName?: string | null;

  status: OnboardingTemplateVersionStatus;

  isCurrent: boolean;

  effectiveFrom?: string | null;

  publishedAt?: string | null;

  publishedByUserId?: string | null;

  changeSummary?: string | null;

  createdAt: string;

  updatedAt: string;
}
