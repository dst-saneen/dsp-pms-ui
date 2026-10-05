import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

import { OperationCommandDto } from './operation-command.dto';

export class AssignEmployeeAssetCommandDto extends OperationCommandDto {
  @IsUUID()
  employeeId!: string;

  @IsUUID()
  assetId!: string;

  @IsDateString()
  assignedDate!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedAssetVersion?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}

export class AcknowledgeCustodyCommandDto extends OperationCommandDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion?: number;
}
