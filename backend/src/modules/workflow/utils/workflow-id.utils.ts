import { randomUUID } from 'crypto';

export class WorkflowIdUtils {
  private constructor() {}

  static workflowId(): string {
    return randomUUID();
  }

  static departmentId(): string {
    return randomUUID();
  }

  static contributionId(): string {
    return randomUUID();
  }

  static requirementId(): string {
    return randomUUID();
  }

  static executionProfileId(): string {
    return randomUUID();
  }

  static executionRuleId(): string {
    return randomUUID();
  }

  static workflowCode(): string {
    return 'WF';
  }

  static departmentCode(workflowCode: string, displayOrder: number): string {
    return `${workflowCode}-D${this.pad(displayOrder)}`;
  }

  static contributionCode(
    departmentCode: string,
    displayOrder: number,
  ): string {
    return `${departmentCode}-C${this.pad(displayOrder)}`;
  }

  static requirementCode(
    contributionCode: string,
    displayOrder: number,
  ): string {
    return `${contributionCode}-R${this.pad(displayOrder)}`;
  }

  static executionProfileCode(
    contributionCode: string,
    displayOrder: number,
  ): string {
    return `${contributionCode}-P${this.pad(displayOrder)}`;
  }

  static executionRuleCode(profileCode: string, sequenceNo: number): string {
    return `${profileCode}-E${this.pad(sequenceNo)}`;
  }

  private static pad(value: number): string {
    return value.toString().padStart(2, '0');
  }
}
