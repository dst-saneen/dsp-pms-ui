import { PartialType } from '@nestjs/swagger';

import { CreateOnboardingTemplateDto } from './create-onboarding-template.dto';

export class UpdateOnboardingTemplateDto extends PartialType(
  CreateOnboardingTemplateDto,
) {}
