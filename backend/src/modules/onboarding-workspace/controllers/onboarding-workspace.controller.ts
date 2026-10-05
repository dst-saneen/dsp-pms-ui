import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';

import { OnboardingWorkspaceService } from '../services';
import { OnboardingEnabledGuard } from '../../onboarding-runtime/guards/onboarding-enabled.guard';

@Controller('onboarding-workspace')
@UseGuards(OnboardingEnabledGuard)
export class OnboardingWorkspaceController {
  constructor(private readonly service: OnboardingWorkspaceService) {}

  @Get('template-version/:versionId')
  loadTemplateVersion(
    @Param('versionId', ParseUUIDPipe)
    versionId: string,
  ) {
    return this.service.loadTemplateVersion(versionId);
  }
}
