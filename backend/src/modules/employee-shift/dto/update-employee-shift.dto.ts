import { PartialType } from '@nestjs/swagger';

import { CreateEmployeeShiftDto } from './create-employee-shift.dto';

export class UpdateEmployeeShiftDto extends PartialType(
  CreateEmployeeShiftDto,
) {}
