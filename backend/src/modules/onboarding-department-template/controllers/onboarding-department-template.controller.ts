import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import {
  CreateOnboardingDepartmentTemplateDto,
  UpdateOnboardingDepartmentTemplateDto,
} from '../dto';

import { OnboardingDepartmentTemplateService } from '../services';
import { VersionedDeleteDto } from '../../onboarding-template/dto';
import { OnboardingEnabledGuard } from '../../onboarding-runtime/guards/onboarding-enabled.guard';

@Controller('onboarding-department-template')
@UseGuards(OnboardingEnabledGuard)
export class OnboardingDepartmentTemplateController {
  constructor(private readonly service: OnboardingDepartmentTemplateService) {}

  @Post()
  create(
    @Body()
    dto: CreateOnboardingDepartmentTemplateDto,
  ) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('template-version/:versionId')
  findByTemplateVersionId(
    @Param('versionId', ParseUUIDPipe)
    versionId: string,
  ) {
    return this.service.findByTemplateVersionId(versionId);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe)
    id: string,
  ) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe)
    id: string,

    @Body()
    dto: UpdateOnboardingDepartmentTemplateDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe)
    id: string,
    @Query() query: VersionedDeleteDto,
  ) {
    return this.service.remove(id, query.expectedVersion);
  }
}
