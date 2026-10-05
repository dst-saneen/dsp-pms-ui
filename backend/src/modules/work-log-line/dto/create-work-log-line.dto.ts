import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateWorkLogLineDto {
  @ApiProperty()
  @IsUUID()
  workLogHeaderId: string;

  @ApiProperty()
  @IsDateString()
  workDate: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  taskId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  workCategoryId?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  hours: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  remarks?: string;
}
