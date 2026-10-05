import { PartialType } from '@nestjs/mapped-types';
import { CreateEmployeeSalaryDto } from './create-employee-salary.dto';

export class UpdateEmployeeSalaryDto extends PartialType(
  CreateEmployeeSalaryDto,
) {}
