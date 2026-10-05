import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsInt, Min } from 'class-validator';

import { OnboardingTemplateVersionService } from './services';
import { OnboardingEnabledGuard } from '../onboarding-runtime/guards/onboarding-enabled.guard';

class PublishOnboardingTemplateVersionDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

@Controller('onboarding-template-version')
@UseGuards(OnboardingEnabledGuard)
export class OnboardingTemplateVersionController {
  constructor(
    private readonly versionService: OnboardingTemplateVersionService,
  ) {}

  @Get('template/:templateId')
  history(
    @Param('templateId', ParseUUIDPipe)
    templateId: string,
  ) {
    return this.versionService.getVersionHistory(templateId);
  }

  @Get(':versionId/asset-types')
  listExecutableAssetTypes(
    @Param('versionId', ParseUUIDPipe)
    versionId: string,
  ) {
    return this.versionService.listExecutableAssetTypes(versionId);
  }

  @Post(':versionId/draft')
  createDraft(
    @Param('versionId', ParseUUIDPipe)
    versionId: string,
  ) {
    return this.versionService.createDraft(versionId);
  }

  @Post(':versionId/validate')
  validate(
    @Param('versionId', ParseUUIDPipe)
    versionId: string,
  ) {
    return this.versionService.validate(versionId);
  }

  @Post(':versionId/publish')
  publish(
    @Param('versionId', ParseUUIDPipe)
    versionId: string,
    @Body()
    dto: PublishOnboardingTemplateVersionDto,
  ) {
    return this.versionService.publish(versionId, dto.expectedVersion);
  }

  @Post(':versionId/archive')
  archive(
    @Param('versionId', ParseUUIDPipe)
    versionId: string,
  ) {
    return this.versionService.archive(versionId);
  }
}
