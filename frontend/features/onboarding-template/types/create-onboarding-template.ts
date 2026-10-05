/**
 * Enterprise Onboarding Template
 * Create DTO
 *
 * HR-0019F-01
 */

export interface CreateOnboardingTemplate {
  /**
   * Company
   */
  companyId: string;

  /**
   * Department owning this template
   */
  departmentId?: string;

  /**
   * Unique template code
   */
  templateCode: string;

  /**
   * Display name
   */
  templateName: string;

  /**
   * Optional description
   */
  description?: string;

  /**
   * Default template for matching scope
   */
  isDefault?: boolean;

  /**
   * Active status
   */
  isActive?: boolean;

  /**
   * Effective period
   */
  effectiveFrom?: string;

  effectiveUntil?: string;

  /**
   * Scope matching
   */
  scope?: {
    companyId: string;

    branchIds: string[];

    departmentIds: string[];

    designationIds: string[];

    employmentTypeIds: string[];

    employmentCategoryIds: string[];
  };
}