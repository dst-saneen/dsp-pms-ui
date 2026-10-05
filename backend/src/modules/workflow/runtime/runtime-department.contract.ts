import { RuntimeContribution } from './runtime-contribution.contract';

export interface RuntimeDepartment {
  readonly runtimeDepartmentId: string;

  readonly runtimeDepartmentCode: string;

  readonly departmentTemplateId: string;

  readonly departmentId: string;

  readonly departmentCode?: string;

  readonly departmentName: string;

  readonly displayOrder: number;

  readonly contributions: readonly RuntimeContribution[];
}
