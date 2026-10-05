import { Injectable } from '@nestjs/common';

import { OnboardingScopeService } from '../../onboarding-runtime/services/onboarding-scope.service';

@Injectable()
export class TaskAssembler {
  constructor(private readonly scopeService: OnboardingScopeService) {}

  load(taskGroupIds: string[]) {
    return this.scopeService.loadTemplateTasks(taskGroupIds);
  }
}
