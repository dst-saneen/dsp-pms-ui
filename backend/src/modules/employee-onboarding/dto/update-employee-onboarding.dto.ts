import { PartialType } from '@nestjs/swagger';

import { CreateEmployeeOnboardingDto } from './create-employee-onboarding.dto';

export class UpdateEmployeeOnboardingDto extends PartialType(
  CreateEmployeeOnboardingDto,
) {}
