import type {
  OnboardingTemplateScope,
} from "./onboarding-template-scope";

import type {
  OnboardingTemplateVersion,
} from "./onboarding-version";

export interface OnboardingTemplate {

  id: string;

  companyId: string;

  companyName?: string | null;

  departmentId: string;

  departmentName?: string | null;

  templateCode: string;

  templateName: string;

  description?: string | null;

  isActive: boolean;

  /**
   * Current editable version
   */
  version?: OnboardingTemplateVersion;

  isDefault?: boolean;

  effectiveFrom?: string | null;

  effectiveUntil?: string | null;

  scope?: OnboardingTemplateScope;

  createdAt: string;

  updatedAt: string;

}