import { Injectable } from '@nestjs/common';

import { OnboardingScopeService } from '../../onboarding-runtime/services/onboarding-scope.service';

@Injectable()
export class TaskGroupAssembler {
  constructor(private readonly scopeService: OnboardingScopeService) {}

  load(departmentTemplateIds: string[]) {
    return this.scopeService.loadTaskGroups(departmentTemplateIds);
  }
}
