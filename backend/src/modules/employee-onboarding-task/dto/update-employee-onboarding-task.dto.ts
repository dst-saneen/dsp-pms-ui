import { PartialType } from '@nestjs/swagger';
import { CreateEmployeeOnboardingTaskDto } from './create-employee-onboarding-task.dto';

export class UpdateEmployeeOnboardingTaskDto extends PartialType(
  CreateEmployeeOnboardingTaskDto,
) {}
