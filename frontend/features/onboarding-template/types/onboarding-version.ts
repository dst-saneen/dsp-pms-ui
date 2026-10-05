import type {
  OnboardingDepartmentTemplate,
} from "@/features/onboarding-department-template";

export enum OnboardingTemplateVersionStatus {
  DRAFT = "DRAFT",
  PUBLISHED = "PUBLISHED",
  ARCHIVED = "ARCHIVED",
}

export interface OnboardingTemplateVersion {

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

  rowVersion?: number;

  /**
   * Designer hierarchy
   */
  departments: OnboardingDepartmentTemplate[];

  createdAt: string;

  updatedAt: string;

}