import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CompanyHolidayPolicyQueryDto {
  @ApiProperty()
  @IsUUID()
  companyId!: string;

  @ApiPropertyOptional({ example: 2027 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;
}

export class UpsertCompanyHolidayPolicyDto {
  @ApiProperty({ minimum: 1, maximum: 366, example: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(366)
  maximumHolidayDays!: number;

  @ApiProperty({
    description:
      'Leave type with category OPTIONAL_HOLIDAY for the same company',
  })
  @IsUUID()
  optionalHolidayLeaveTypeId!: string;
}
