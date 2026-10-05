import { OnboardingDepartmentStatus } from '../enums';

export class OnboardingDepartment {
  /**
   * Identity
   */
  id!: string;

  onboardingTemplateId!: string;

  /**
   * HR Department Reference
   */
  departmentId!: string;

  departmentCode!: string;

  departmentName!: string;

  /**
   * Configuration
   */
  displayOrder!: number;

  status!: OnboardingDepartmentStatus;

  isMandatory!: boolean;

  /**
   * Ownership
   */
  ownerEmployeeId?: string;

  /**
   * Audit
   */
  createdAt!: Date;

  updatedAt!: Date;
}
