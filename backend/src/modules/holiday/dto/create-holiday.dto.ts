import { IsString, IsOptional, IsUUID, IsDateString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateHolidayDto {
  @ApiProperty()
  @IsUUID()
  companyId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  holidayCode?: string;

  @ApiProperty()
  @IsString()
  holidayName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsDateString()
  holidayDate: string;

  @ApiProperty({
    example: 'PUBLIC',
  })
  @IsString()
  holidayType: string;
}
