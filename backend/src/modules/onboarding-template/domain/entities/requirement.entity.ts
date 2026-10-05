import { RequirementStatus, RequirementType } from '../enums';

export class Requirement {
  /**
   * Identity
   */
  id!: string;

  onboardingDepartmentId!: string;

  /**
   * Business
   */
  requirementCode!: string;

  requirementName!: string;

  description?: string;

  /**
   * Classification
   */
  requirementType!: RequirementType;

  /**
   * Behaviour
   */
  isMandatory!: boolean;

  isBlocking!: boolean;

  allowParallelExecution!: boolean;

  displayOrder!: number;

  /**
   * Lifecycle
   */
  status!: RequirementStatus;

  /**
   * Audit
   */
  createdAt!: Date;

  updatedAt!: Date;
}
