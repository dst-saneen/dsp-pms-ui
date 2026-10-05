import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { OnboardingTemplateEditor } from './contracts';

import { CreateOnboardingTemplateDto } from './dto/create-onboarding-template.dto';

import { UpdateOnboardingTemplateDto } from './dto/update-onboarding-template.dto';

import {
  OnboardingTemplateService,
  OnboardingTemplateWorkspaceService,
} from './services';
import { OnboardingEnabledGuard } from '../onboarding-runtime/guards/onboarding-enabled.guard';

@Controller('onboarding-template')
@UseGuards(OnboardingEnabledGuard)
export class OnboardingTemplateController {
  constructor(
    private readonly service: OnboardingTemplateService,

    private readonly workspaceService: OnboardingTemplateWorkspaceService,
  ) {}

  @Post()
  create(
    @Body()
    dto: CreateOnboardingTemplateDto,
  ) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id/editor')
  async getEditor(
    @Param('id', ParseUUIDPipe)
    id: string,
  ): Promise<OnboardingTemplateEditor> {
    return this.workspaceService.getEditor(id);
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
    dto: UpdateOnboardingTemplateDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe)
    id: string,
  ) {
    return this.service.remove(id);
  }
}
