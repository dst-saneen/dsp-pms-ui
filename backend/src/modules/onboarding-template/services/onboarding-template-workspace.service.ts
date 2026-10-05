import { Injectable, NotFoundException } from '@nestjs/common';

import { OnboardingTemplateService } from './onboarding-template.service';

import { OnboardingTemplateWorkspaceBuilder } from '../builders';

import { OnboardingTemplateEditor } from '../contracts';

@Injectable()
export class OnboardingTemplateWorkspaceService {
  constructor(
    private readonly templateService: OnboardingTemplateService,

    private readonly builder: OnboardingTemplateWorkspaceBuilder,
  ) {}

  async getEditor(id: string): Promise<OnboardingTemplateEditor> {
    const template = await this.templateService.findOne(id);

    const version =
      template.versions?.find((v: { isCurrent: boolean }) => v.isCurrent) ??
      template.versions?.[0];

    if (!version) {
      throw new NotFoundException('Current template version not found.');
    }

    return this.builder.build(template, version);
  }
}
