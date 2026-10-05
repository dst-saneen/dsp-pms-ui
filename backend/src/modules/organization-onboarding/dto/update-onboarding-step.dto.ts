import { OrganizationOnboardingStep } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateOnboardingStepDto {
  @IsEnum(OrganizationOnboardingStep)
  currentStep: OrganizationOnboardingStep;
}
