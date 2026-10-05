import { PartialType } from '@nestjs/mapped-types';
import { CreateEmployeeTaxProfileDto } from './create-employee-tax-profile.dto';

export class UpdateEmployeeTaxProfileDto extends PartialType(
  CreateEmployeeTaxProfileDto,
) {}
