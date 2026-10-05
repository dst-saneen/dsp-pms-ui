import { PartialType } from '@nestjs/mapped-types';

import { CreateEmployeeSeparationDto } from './create-employee-separation.dto';

export class UpdateEmployeeSeparationDto extends PartialType(
  CreateEmployeeSeparationDto,
) {}
