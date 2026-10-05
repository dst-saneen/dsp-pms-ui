import { Injectable } from '@nestjs/common';

import { OnboardingScopeService } from '../../onboarding-runtime/services/onboarding-scope.service';

@Injectable()
export class ContributionAssembler {
  constructor(private readonly scopeService: OnboardingScopeService) {}

  async load(taskIds: string[]): Promise<never[]> {
    await Promise.all(
      taskIds.map((taskId) => this.scopeService.assertTaskInScope(taskId)),
    );
    return [];
  }
}
