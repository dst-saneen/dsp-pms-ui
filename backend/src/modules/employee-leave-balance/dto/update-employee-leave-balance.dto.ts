import { Type } from 'class-transformer';
import {
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateEmployeeLeaveBalanceDto {
  @ApiProperty({
    description:
      'Replacement annual entitlement days. Used and pending cannot be edited here.',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @Max(400)
  entitlement!: number;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
