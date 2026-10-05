import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum AssetReturnOutcome {
  RETURNED = 'RETURNED',
  LOST = 'LOST',
  DAMAGED = 'DAMAGED',
}

export class ReturnAssetDto {
  @ApiProperty({ enum: AssetReturnOutcome })
  @IsEnum(AssetReturnOutcome)
  outcome: AssetReturnOutcome;

  @ApiProperty()
  @IsDateString()
  returnedDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}
