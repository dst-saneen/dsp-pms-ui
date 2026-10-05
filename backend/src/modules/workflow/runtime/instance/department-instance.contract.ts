import { RuntimeDepartment } from '../runtime-department.contract';
import { WorkflowRuntimeStatus } from './workflow-runtime.enums';
import { ContributionInstance } from './contribution-instance.contract';

export interface DepartmentInstance {
  readonly runtimeDepartmentId: string;

  readonly definition: RuntimeDepartment;

  readonly status: WorkflowRuntimeStatus;

  readonly contributions: readonly ContributionInstance[];
}
