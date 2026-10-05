import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateWorkCategoryDto {
  @ApiProperty()
  @IsString()
  categoryCode: string;

  @ApiProperty()
  @IsString()
  categoryName: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isBillable?: boolean;
}
