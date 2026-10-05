export enum WorkflowActorType {
  USER = 'USER',

  ROLE = 'ROLE',

  DEPARTMENT = 'DEPARTMENT',

  POSITION = 'POSITION',

  SUBJECT = 'SUBJECT',

  INITIATOR = 'INITIATOR',

  REPORTING_MANAGER = 'REPORTING_MANAGER',

  ORGANIZATION_OWNER = 'ORGANIZATION_OWNER',

  SYSTEM = 'SYSTEM',

  EXPRESSION = 'EXPRESSION',
}

export interface ActorReference {
  readonly type: WorkflowActorType;

  /**
   * Optional identifier.
   *
   * Examples:
   * - Department Id
   * - Role Id
   * - Position Id
   * - User Id
   */
  readonly referenceId?: string;

  /**
   * Optional expression.
   *
   * Example:
   * employee.department.manager
   */
  readonly expression?: string;
}
