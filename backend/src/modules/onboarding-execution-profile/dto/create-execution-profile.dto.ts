import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateExecutionProfileDto {
  @IsUUID()
  contributionId: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  profileCode?: string;

  @IsString()
  @MaxLength(200)
  profileName: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
