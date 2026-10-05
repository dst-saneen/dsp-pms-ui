import { OnboardingTemplateStatus, OnboardingTemplateType } from '../enums';

export class OnboardingTemplate {
  /**
   * Identity
   */
  id!: string;

  companyId!: string;

  /**
   * Template Classification
   */
  templateType!: OnboardingTemplateType;

  /**
   * Template
   */
  templateCode!: string;

  templateName!: string;

  description?: string;

  /**
   * Lifecycle
   */
  status!: OnboardingTemplateStatus;

  /**
   * Version
   */
  versionNo!: number;

  isCurrent!: boolean;

  /**
   * Ownership
   */
  ownerDepartmentId!: string;

  /**
   * Effective Period
   */
  effectiveFrom?: Date;

  effectiveUntil?: Date;

  /**
   * Audit
   */
  createdBy!: string;

  createdAt!: Date;

  updatedBy?: string;

  updatedAt!: Date;
}
