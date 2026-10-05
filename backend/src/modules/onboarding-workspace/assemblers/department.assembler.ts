import { Injectable } from '@nestjs/common';

import { OnboardingScopeService } from '../../onboarding-runtime/services/onboarding-scope.service';

@Injectable()
export class DepartmentAssembler {
  constructor(private readonly scopeService: OnboardingScopeService) {}

  load(versionId: string) {
    return this.scopeService.loadDepartmentTemplates(versionId);
  }
}
