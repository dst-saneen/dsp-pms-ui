import { PartialType } from '@nestjs/swagger';
import { CreateEmployeeClearanceDto } from './create-employee-clearance.dto';

export class UpdateEmployeeClearanceDto extends PartialType(
  CreateEmployeeClearanceDto,
) {}
