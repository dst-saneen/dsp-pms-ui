import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

import { OperationCommandDto } from './operation-command.dto';

export class CreateFinancePeriodDto extends OperationCommandDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  periodYear!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  periodMonth!: number;
}
