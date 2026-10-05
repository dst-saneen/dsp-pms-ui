import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OptionalHolidayYearQueryDto {
  @ApiPropertyOptional({ example: 2027 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;
}

export class UpdateOptionalHolidaySelectionsDto {
  @ApiProperty({
    type: [String],
    description: 'Desired optional-holiday event IDs for the year (full set)',
  })
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  eventIds!: string[];
}
