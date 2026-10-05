import { Injectable } from '@nestjs/common';

@Injectable()
export class EmployeeOnboardingWorkflowService {
  start(onboardingId: string): never {
    throw new Error(
      `EmployeeOnboardingWorkflowService.start(${onboardingId}) is not implemented.`,
    );
  }
}
