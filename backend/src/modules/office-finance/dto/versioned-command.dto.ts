import { Type } from 'class-transformer';
import { IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';

import { OperationCommandDto } from './operation-command.dto';

export class VersionedCommandDto extends OperationCommandDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedVersion!: number;
}

export class VersionedReasonCommandDto extends VersionedCommandDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}
