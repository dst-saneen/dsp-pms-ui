// import { Injectable } from '@nestjs/common';

// import { EmployeeOnboardingTaskService } from '../../../employee-onboarding-task/employee-onboarding-task.service';

// import {
//   WorkflowTaskProvider,
//   WorkflowContext,
// } from '../../../workflow/runtime';

// import {
//   WorkflowInstance,
//   ExecutionRuleInstance,
// } from '../../../workflow/runtime/instance';

// @Injectable()
// export class EmployeeOnboardingTaskProvider
//   implements WorkflowTaskProvider
// {
//   constructor(
//     private readonly taskService: EmployeeOnboardingTaskService,
//   ) {}

//   async createTask(
//     workflow: WorkflowInstance,
//     rule: ExecutionRuleInstance,
//     context: WorkflowContext,
//   ): Promise<string> {
//     throw new Error(
//       'EmployeeOnboardingTaskProvider.createTask() not implemented.',
//     );
//   }

//   async completeTask(
//     taskId: string,
//   ): Promise<void> {
//     throw new Error(
//       'EmployeeOnboardingTaskProvider.completeTask() not implemented.',
//     );
//   }

//   async cancelTask(
//     taskId: string,
//   ): Promise<void> {
//     throw new Error(
//       'EmployeeOnboardingTaskProvider.cancelTask() not implemented.',
//     );
//   }
// }
