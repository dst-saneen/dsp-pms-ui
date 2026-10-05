import {
  ExecutionMode,
  ExecutionOwnerType,
  ExecutionProfileStatus,
} from '../enums';

export class ExecutionProfile {
  /**
   * Identity
   */
  id!: string;

  requirementId!: string;

  /**
   * Profile
   */
  profileCode!: string;

  profileName!: string;

  description?: string;

  /**
   * Execution
   */
  executionMode!: ExecutionMode;

  ownerType!: ExecutionOwnerType;

  /**
   * Platform Reference
   *
   * References an existing EAP capability.
   */
  referenceType?: string;

  referenceId?: string;

  /**
   * Behaviour
   */
  autoExecute!: boolean;

  allowRetry!: boolean;

  timeoutMinutes?: number;

  displayOrder!: number;

  /**
   * Lifecycle
   */
  status!: ExecutionProfileStatus;

  /**
   * Audit
   */
  createdAt!: Date;

  updatedAt!: Date;
}
