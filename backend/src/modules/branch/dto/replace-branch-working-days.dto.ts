import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class BranchWorkingDayItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @IsBoolean()
  isWorkingDay!: boolean;
}

export class ReplaceBranchWorkingDaysDto {
  @IsArray()
  @ArrayMinSize(7)
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => BranchWorkingDayItemDto)
  days!: BranchWorkingDayItemDto[];

  @IsBoolean()
  markReviewed!: boolean;
}
